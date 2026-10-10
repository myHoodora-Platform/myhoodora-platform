import type { ConfigService } from "@nestjs/config";
import { Types } from "mongoose";
import { EventRemindersService } from "./event-reminders.service";

const H = 60 * 60 * 1000;
const now = new Date("2026-10-01T09:00:00Z");
const at = (h: number) => new Date(now.getTime() + h * H);

/** Minimal Mongoose-like query: .select().lean().exec() → value. */
const q = <T>(value: T) => ({ select: () => q(value), lean: () => q(value), exec: async () => value });

/** In-memory stand-ins whose updateOne honours `{ field: { $ne: kind } }` + `$addToSet`, like Mongo. */
function world(eventStart: Date, rsvps: { uid: string; status: "going" | "interested"; updatedAt?: Date }[], members: string[]) {
  const post = { _id: new Types.ObjectId(), authorUid: "host", neighborhoodId: "hood-1", message: "Road 12 clean-up. Gloves provided.", content: "", eventDate: eventStart, eventLocation: "Road 12 park", hostNotices: [] as string[] };
  const rows = rsvps.map((r) => ({ _id: new Types.ObjectId(), remindersSent: [] as string[], updatedAt: at(-24), ...r }));
  const addOnce = (list: string[], kind: string) => (list.includes(kind) ? 0 : (list.push(kind), 1));
  const posts = {
    find: () => q([post]),
    updateOne: (f: { _id: Types.ObjectId; hostNotices: { $ne: string } }) => ({ exec: async () => ({ modifiedCount: addOnce(post.hostNotices, f.hostNotices.$ne) }) }),
  };
  const rsvpModel = {
    find: () => q(rows.map((r) => ({ ...r, remindersSent: [...r.remindersSent] }))),
    updateOne: (f: { _id: Types.ObjectId; remindersSent: { $ne: string } }) => ({
      exec: async () => ({ modifiedCount: addOnce(rows.find((r) => r._id.equals(f._id))!.remindersSent, f.remindersSent.$ne) }),
    }),
  };
  const users = {
    find: () => q(members.map((uid) => ({ uid }))),
    findOne: () => q({ displayName: "Adaeze" }),
  };
  const notify = jest.fn(async (_input: unknown) => 1);
  const config = { get: (k: string) => (k === "appUrl" ? "https://myhoodora.test" : true) } as unknown as ConfigService;
  const make = () => new EventRemindersService(posts as never, rsvpModel as never, users as never, { notify } as never, config);
  return { post, rows, notify, make };
}

describe("EventRemindersService", () => {
  it("sends the final reminder once, even when two instances run at the same time", async () => {
    const w = world(at(2.5), [{ uid: "ada", status: "going" }], ["ada"]);
    const [a, b] = [w.make(), w.make()];
    await Promise.all([a.tick(now), b.tick(now)]);
    await a.tick(now);
    const finals = w.notify.mock.calls.filter(([input]) => (input as { kind: string }).kind === "event_reminder_final");
    expect(finals).toHaveLength(1);
    expect(finals[0]![0]).toMatchObject({ uids: ["ada"], title: "Starting in 3 hours: Road 12 clean-up", href: `/p/${w.post._id}`, subjectId: String(w.post._id), category: "events", actorUid: "host" });
  });

  it("Going gets the 2-day reminder, Interested the day-before nudge, with event details", async () => {
    const w = world(at(20), [{ uid: "ada", status: "going" }, { uid: "tunde", status: "interested" }], ["ada", "tunde"]);
    await w.make().tick(now);
    const byUid = Object.fromEntries(w.notify.mock.calls.map(([i]) => [(i as { uids: string[] }).uids[0], i]));
    expect(byUid.ada).toMatchObject({ kind: "event_reminder", body: "You said you're going · Road 12 park." });
    expect((byUid.ada as { title: string }).title).toMatch(/^Reminder: Road 12 clean-up is on /);
    expect(byUid.tunde).toMatchObject({ title: "Road 12 clean-up is tomorrow. Still interested?", body: "Tap Going so Adaeze knows to expect you." });
  });

  it("host gets '2 days: n going, m interested' once", async () => {
    const w = world(at(40), [{ uid: "ada", status: "going" }, { uid: "tunde", status: "interested" }], ["ada", "tunde"]);
    const s = w.make();
    await s.tick(now);
    await s.tick(now);
    const host = w.notify.mock.calls.filter(([i]) => (i as { uids: string[] }).uids[0] === "host");
    expect(host).toHaveLength(1);
    expect(host[0]![0]).toMatchObject({ title: "Your event is in 2 days: 1 going, 1 interested", actorUid: undefined });
  });

  it("skips people who have left the Hood", async () => {
    const w = world(at(2), [{ uid: "ada", status: "going" }, { uid: "moved", status: "going" }], ["ada"]);
    await w.make().tick(now);
    expect(w.notify.mock.calls.map(([i]) => (i as { uids: string[] }).uids[0])).toEqual(["ada"]);
  });

  it("the morning after: host recap prompt and attendee thank-you", async () => {
    const w = world(at(-15), [{ uid: "ada", status: "going" }, { uid: "tunde", status: "interested" }], ["ada", "tunde"]);
    await w.make().tick(now);
    const titles = w.notify.mock.calls.map(([i]) => (i as { title: string }).title);
    expect(titles).toEqual(["How did Road 12 clean-up go?", "Hope you enjoyed Road 12 clean-up"]);
    expect(w.notify.mock.calls.every(([i]) => (i as { kind: string }).kind === "event_followup")).toBe(true);
  });

  it("emails only through the normal preference gate, with a stable idempotency key", async () => {
    const w = world(at(2), [{ uid: "ada", status: "going" }], ["ada"]);
    await w.make().tick(now);
    const email = (w.notify.mock.calls[0]![0] as { email: { idempotencyKey: (u: string) => string; force?: boolean; render: (n?: string) => { subject: string } } }).email;
    expect(email.force).toBeUndefined();
    expect(email.idempotencyKey("ada")).toBe(`event:${w.post._id}:going_final:ada`);
    expect(email.render("Ada").subject).toMatch(/Starting in 3 hours/);
  });
});
