import { Job } from "../src/jobs/job.schema";
import { JobsService } from "../src/jobs/jobs.service";
import { createTestApp, type TestApp } from "./helpers/app";
jest.mock("../src/config/firebase.config", () => jest.requireActual("./helpers/firebase-mock").firebaseMock);

/**
 * The job runner against a real MongoDB: what makes it trustworthy is the record and the atomic
 * claim, and neither can be shown with a stand-in. Time is moved by editing `runAt` / `lockedUntil`
 * on the record, which is exactly what the passing of time changes.
 */
describe("Background jobs: recorded, run once, retried, taken over", () => {
  let t: TestApp;
  let jobs: JobsService;
  const rows = () => t.model<Job>(Job.name);
  const find = (type: string) => rows().findOne({ type }).lean();
  /** Makes a waiting retry due now, as if its delay had passed. */
  const makeDue = (type: string) => rows().updateOne({ type }, { $set: { runAt: new Date(Date.now() - 1000) } });
  const silenceLogs = () => jest.spyOn((jobs as unknown as { logger: { warn: () => void; error: () => void } }).logger, "warn").mockImplementation(() => undefined);

  beforeAll(async () => {
    t = await createTestApp();
    jobs = t.app.get(JobsService);
    jest.spyOn((jobs as unknown as { logger: { error: () => void } }).logger, "error").mockImplementation(() => undefined);
    silenceLogs();
  });
  afterAll(() => t.close());

  it("runs a job after it is recorded, with its payload, and marks it done", async () => {
    const seen: unknown[] = [];
    jobs.register("test.simple", async (payload) => void seen.push(payload));
    expect(await jobs.enqueue("test.simple", { postId: "p1" })).toBe(true);
    await jobs.drain();
    expect(seen).toEqual([{ postId: "p1" }]);
    expect(await find("test.simple")).toMatchObject({ status: "done", attempts: 1, finishedAt: expect.any(Date) });
  });

  it("enqueueing resolves once the job is recorded, not once it has run", async () => {
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    let finished = false;
    jobs.register("test.slow", async () => {
      await held;
      finished = true;
    });
    await jobs.enqueue("test.slow", {});
    expect(finished).toBe(false);
    release();
    await jobs.drain();
    expect(finished).toBe(true);
  });

  it("the same dedupeKey is recorded once, however often it is enqueued", async () => {
    let runs = 0;
    jobs.register("test.once", async () => void runs++);
    const results = await Promise.all(Array.from({ length: 5 }, () => jobs.enqueue("test.once", {}, { dedupeKey: "once:42" })));
    expect(results.filter(Boolean)).toHaveLength(1);
    await jobs.drain();
    // …including after it has finished: a late duplicate is still a duplicate.
    expect(await jobs.enqueue("test.once", {}, { dedupeKey: "once:42" })).toBe(false);
    await jobs.drain();
    expect(runs).toBe(1);
    expect(await rows().countDocuments({ type: "test.once" })).toBe(1);
  });

  it("a failed job is retried later, not at once, and succeeds when the cause has gone", async () => {
    let attempts = 0;
    jobs.register("test.flaky", async () => {
      if (++attempts < 3) throw new Error("database blip");
    });
    await jobs.enqueue("test.flaky", {});
    await jobs.drain();
    const afterFirst = await find("test.flaky");
    expect(afterFirst).toMatchObject({ status: "queued", attempts: 1, lastError: "database blip" });
    // Backed off: not due yet, so another pass leaves it alone.
    expect(afterFirst!.runAt.getTime()).toBeGreaterThan(Date.now() + 20_000);
    expect(await jobs.runDue()).toBe(0);
    expect(attempts).toBe(1);

    await makeDue("test.flaky");
    await jobs.drain();
    const afterSecond = await find("test.flaky");
    expect(afterSecond).toMatchObject({ status: "queued", attempts: 2 });
    // The wait grows with each failure.
    expect(afterSecond!.runAt.getTime() - Date.now()).toBeGreaterThan(afterFirst!.runAt.getTime() - afterFirst!.updatedAt!.getTime());

    await makeDue("test.flaky");
    await jobs.drain();
    expect(await find("test.flaky")).toMatchObject({ status: "done", attempts: 3 });
    expect(attempts).toBe(3);
  });

  it("a job that keeps failing stops at its limit and is kept as 'failed' for someone to look at", async () => {
    let attempts = 0;
    jobs.register("test.broken", async () => {
      attempts++;
      throw new Error("always");
    });
    await jobs.enqueue("test.broken", {}, { maxAttempts: 2 });
    await jobs.drain();
    await makeDue("test.broken");
    await jobs.drain();
    expect(await find("test.broken")).toMatchObject({ status: "failed", attempts: 2, lastError: "always", finishedAt: expect.any(Date) });
    await makeDue("test.broken");
    await jobs.drain();
    expect(attempts).toBe(2);
  });

  it("a job recorded before a restart is run by whoever starts next", async () => {
    // Recorded by an instance that then went away: nothing here was told about it.
    await rows().create({ type: "test.orphan", payload: { n: 1 }, status: "queued", runAt: new Date(Date.now() - 60_000), maxAttempts: 5 });
    let runs = 0;
    jobs.register("test.orphan", async () => void runs++);
    expect(await jobs.runDue()).toBe(1);
    expect(runs).toBe(1);
    expect(await find("test.orphan")).toMatchObject({ status: "done" });
  });

  it("a job whose worker died mid-run is taken over once its claim lapses, and not before", async () => {
    let runs = 0;
    jobs.register("test.abandoned", async () => void runs++);
    await rows().create({ type: "test.abandoned", payload: {}, status: "running", attempts: 1, runAt: new Date(Date.now() - 60_000), lockedUntil: new Date(Date.now() + 60_000), maxAttempts: 5 });
    // Its worker may well still be alive.
    expect(await jobs.runDue()).toBe(0);
    expect(runs).toBe(0);

    await rows().updateOne({ type: "test.abandoned" }, { $set: { lockedUntil: new Date(Date.now() - 1000) } });
    expect(await jobs.runDue()).toBe(1);
    expect(runs).toBe(1);
    expect(await find("test.abandoned")).toMatchObject({ status: "done", attempts: 2 });
  });

  it("two instances looking at the same moment: one of them runs the job", async () => {
    // A second runner on the same database stands in for a second API instance.
    const other = new JobsService(rows() as never);
    let runs = 0;
    const handler = async () => {
      runs++;
      await new Promise((r) => setTimeout(r, 50));
    };
    jobs.register("test.contended", handler);
    other.register("test.contended", handler);
    await rows().create({ type: "test.contended", payload: {}, status: "queued", runAt: new Date(Date.now() - 1000), maxAttempts: 5 });
    const ran = await Promise.all([jobs.runDue(), other.runDue()]);
    expect(ran.reduce((a, b) => a + b, 0)).toBe(1);
    expect(runs).toBe(1);
  });

  it("leaves job types this build doesn't know (a newer instance's) for an instance that does", async () => {
    await rows().create({ type: "test.from-the-future", payload: {}, status: "queued", runAt: new Date(Date.now() - 1000), maxAttempts: 5 });
    await jobs.drain();
    expect(await find("test.from-the-future")).toMatchObject({ status: "queued", attempts: 0 });
  });

  it("something that stops its worker every time is given up on, instead of being taken over forever", async () => {
    let runs = 0;
    jobs.register("test.poison", async () => void runs++);
    await rows().create({ type: "test.poison", payload: {}, status: "running", attempts: 2, runAt: new Date(Date.now() - 60_000), lockedUntil: new Date(Date.now() - 1000), maxAttempts: 2 });
    await jobs.drain();
    expect(runs).toBe(0);
    expect(await find("test.poison")).toMatchObject({ status: "failed", finishedAt: expect.any(Date) });
  });
});
