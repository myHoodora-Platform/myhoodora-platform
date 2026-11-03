import { checkKindness } from "./kindness";

describe("checkKindness", () => {
  it("passes ordinary neighbourly posts", () => {
    expect(checkKindness("Does anyone know a good plumber near Admiralty Way?")).toEqual({ flagged: false, reasons: [] });
  });

  it("flags name-calling, including Nigerian terms, on word boundaries only", () => {
    expect(checkKindness("You are a complete idiot")).toEqual({ flagged: true, reasons: ["insult"] });
    expect(checkKindness("this werey no dey hear word")).toMatchObject({ reasons: ["insult"] });
    expect(checkKindness("Please SHUT   UP about the generator")).toMatchObject({ reasons: ["insult"] });
    // "Odeyemi" contains "ode"; "foolproof" contains "fool": neither is an insult.
    expect(checkKindness("Mr Odeyemi fixed it, foolproof work").flagged).toBe(false);
  });

  it("flags first-person threats but not reports of crime", () => {
    expect(checkKindness("If you park there again I will deal with you")).toMatchObject({ reasons: ["threat"] });
    expect(checkKindness("I go beat am if e try am")).toMatchObject({ reasons: ["threat"] });
    expect(checkKindness("Robbers threatened to kill the guard last night").flagged).toBe(false);
  });

  it("flags shouting (long, mostly capitals) but not short caps or acronyms", () => {
    expect(checkKindness("WHO KEEPS DUMPING REFUSE IN FRONT OF MY GATE")).toMatchObject({ reasons: ["shouting"] });
    expect(checkKindness("URGENT: NEPA took light on Road 12, LASEPA notified")).toMatchObject({ flagged: false });
  });

  it("reports every reason that applies", () => {
    expect(checkKindness("YOU ARE A STUPID MAN AND I WILL BEAT YOU").reasons).toEqual(["insult", "threat", "shouting"]);
  });
});
