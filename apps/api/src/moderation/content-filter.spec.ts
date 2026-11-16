import { compileTerms, foldText, isAllowedText, setAdminBlockedTerms } from "./content-filter";

afterEach(() => setAdminBlockedTerms([]));

describe("content filter", () => {
  it("refuses built-in terms, however they're dressed up", () => {
    for (const text of [
      "Selling porn DVDs",
      "Check my P0RN site",
      "send nudes",
      "s e n d   n u d e s",
      "you c.u.n.t",
      "you cuuunt",
      "motherfucker",
      "MOTHERFUCKERS everywhere",
      "what a faggot",
      "Ègbọ́n, porn",
    ]) {
      expect({ text, allowed: isAllowedText(text) }).toEqual({ text, allowed: false });
    }
  });

  it("refuses first-person threats to kill, in English and Pidgin", () => {
    expect(isAllowedText("If you park there again I will kill you")).toBe(false);
    expect(isAllowedText("we go kill am")).toBe(false);
    expect(isAllowedText("I'll stab you")).toBe(false);
  });

  it("leaves innocent words and everyday neighbourhood posts alone", () => {
    for (const text of [
      "Welcome to Nigeria! Niger State and Nigerians all welcome",
      "Scunthorpe United, Essex and Sussex",
      "Classic cocktail night at the clubhouse, assessment on Friday",
      "Robbers said they will kill anyone who resists: please stay indoors",
      "I'll shoot you a message about the generator",
      "Fire retardant spray for sale, ₦5,000",
      "The 4 of us met at 5pm on Road 13",
      "Call 08031234567 for the plumber",
      "I go kill this generator noise with a new silencer",
      "",
    ]) {
      expect({ text, allowed: isAllowedText(text) }).toEqual({ text, allowed: true });
    }
  });

  it("admins' terms are added to the built-in ones, exact or as prefixes", () => {
    expect(isAllowedText("You be ashawo")).toBe(true);
    setAdminBlockedTerms(["ashawo", "olosho*", "  "]);
    expect(isAllowedText("You be ashawo")).toBe(false);
    expect(isAllowedText("oloshos everywhere")).toBe(false);
    expect(isAllowedText("send nudes")).toBe(false); // built-ins stay
    setAdminBlockedTerms([]);
    expect(isAllowedText("You be ashawo")).toBe(true);
  });

  it("folds text and terms the same way", () => {
    expect(foldText("  P0RN!!!  ")).toBe(" porn ");
    expect(foldText("f.u.c.k")).toBe(" fuck ");
    expect(foldText("Nigger")).toBe(" nigger ");
    // Numbers on their own stay numbers (look-alikes only apply inside words; folding is for matching only).
    expect(foldText("₦5,000 on Road 13")).toBe(" 5 000 on road 13 ");
    expect(foldText("sh!t")).toBe(" shit ");
    expect(compileTerms(["", "a", "*"]).pattern).toBeNull();
  });
});
