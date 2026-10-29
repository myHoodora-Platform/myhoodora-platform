import { blankDraft, draftErrors, kindFromParam, newClientId, toNewPost, type Draft } from "../compose-rules";

const draft = (extra: Partial<Draft> = {}): Draft => ({ ...blankDraft(), message: "Anyone know a good tailor in Yaba?", ...extra });

describe("composer rules", () => {
  it("accepts a plain post, and sends only what it uses", () => {
    expect(draftErrors(draft())).toBeNull();
    expect(toNewPost(draft({ urgent: true, thankedName: "x" }), "client-123")).toEqual({ message: "Anyone know a good tailor in Yaba?", category: "general", clientId: "client-123" });
  });

  it("needs something written", () => {
    expect(draftErrors(draft({ message: "   " }))).toEqual({ message: "Write something for your neighbours." });
  });

  it("an alert needs its kind, and carries urgency", () => {
    expect(draftErrors(draft({ category: "alert" }))).toEqual({ alertCategory: "Choose what kind of alert this is." });
    expect(toNewPost(draft({ category: "alert", alertCategory: "power", urgent: true }), "client-123")).toMatchObject({ category: "alert", alertCategory: "power", urgent: true });
  });

  it("a thank-you needs a name", () => {
    expect(draftErrors(draft({ category: "thanks" }))).toEqual({ thankedName: "Who are you thanking?" });
    expect(toNewPost(draft({ category: "thanks", thankedName: " Mama Tunde " }), "client-123")).toMatchObject({ thankedName: "Mama Tunde" });
  });

  it("makes clientIds the API accepts (8–64 letters, digits, - or _)", () => {
    const id = newClientId();
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(newClientId()).not.toBe(id);
  });
});

describe("events", () => {
  const now = new Date("2026-10-28T10:00:00Z");
  it("need a start between an hour ago and a year ahead", () => {
    expect(draftErrors(draft({ category: "event" }), now)?.eventDate).toBe("Choose when it starts.");
    expect(draftErrors(draft({ category: "event", eventDate: new Date("2026-10-28T08:30:00Z") }), now)?.eventDate).toBe("That date has already passed.");
    expect(draftErrors(draft({ category: "event", eventDate: new Date("2027-12-01T10:00:00Z") }), now)?.eventDate).toBe("Events can be up to a year ahead.");
    expect(draftErrors(draft({ category: "event", eventDate: new Date("2026-11-01T09:00:00Z") }), now)).toBeNull();
  });
  it("send the date, the place if given, and the event type", () => {
    const post = toNewPost(draft({ category: "event", eventDate: new Date("2026-11-01T09:00:00Z"), eventLocation: "  Main gate " }), "m12345678");
    expect(post).toMatchObject({ type: "event", category: "event", eventDate: "2026-11-01T09:00:00.000Z", eventLocation: "Main gate" });
    expect(toNewPost(draft({ category: "event", eventDate: new Date("2026-11-01T09:00:00Z") }), "m12345678")).not.toHaveProperty("eventLocation");
  });
});

describe("polls", () => {
  it("need 2–4 different choices; blanks are ignored", () => {
    expect(draftErrors(draft({ category: "poll", pollOptions: ["Yes", ""] }))?.pollOptions).toBe("Add at least 2 choices.");
    expect(draftErrors(draft({ category: "poll", pollOptions: ["Yes", " yes "] }))?.pollOptions).toBe("Each choice must be different.");
    expect(draftErrors(draft({ category: "poll", pollOptions: ["Yes", "No", ""] }))).toBeNull();
  });
  it("send numbered choices and when the poll closes", () => {
    const now = Date.parse("2026-10-28T10:00:00Z");
    const post = toNewPost(draft({ category: "poll", pollOptions: [" Yes ", "", "No"], pollDays: 3 }), "m12345678", now);
    expect(post.poll).toEqual({ options: [{ id: "o1", text: "Yes" }, { id: "o2", text: "No" }], closesAt: "2026-10-31T10:00:00.000Z" });
  });
});

it("a link can open the composer on a kind; anything else is a general post", () => {
  expect(kindFromParam("event")).toBe("event");
  expect(kindFromParam("poll")).toBe("poll");
  expect(kindFromParam("admin")).toBe("general");
  expect(kindFromParam(undefined)).toBe("general");
});
