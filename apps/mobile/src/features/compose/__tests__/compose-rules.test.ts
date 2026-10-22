import { draftErrors, newClientId, toNewPost, type Draft } from "../compose-rules";

const draft = (extra: Partial<Draft> = {}): Draft => ({ category: "general", message: "Anyone know a good tailor in Yaba?", alertCategory: null, urgent: false, thankedName: "", ...extra });

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
