import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fillTemplate, needsLocalDetails, parseContentBank, pollProblem, textForHood } from "./content-bank";
import { DEFAULT_ACTIVATION_PLAN } from "./schedule";

const BANK = readFileSync(join(__dirname, "../../../../../docs/product/hood-content-bank.md"), "utf8");

describe("the content bank file (docs/product/hood-content-bank.md)", () => {
  const { items, problems } = parseContentBank(BANK);

  it("reads every item without problems", () => {
    expect(problems).toEqual([]);
    expect(items.length).toBe(180);
  });

  it("has the planned mix", () => {
    const count = (tag: string) => items.filter((i) => i.tag === tag).length;
    expect({ welcome: count("welcome"), starter: count("starter"), info: count("info"), daily: count("daily"), festive: count("festive") }).toEqual({ welcome: 10, starter: 60, info: 30, daily: 60, festive: 20 });
  });

  it("has every item the default activation plan uses", () => {
    const codes = new Set(items.map((i) => i.code));
    expect(DEFAULT_ACTIVATION_PLAN.map((s) => s.code).filter((c) => !codes.has(c))).toEqual([]);
  });

  it("gives every poll valid options", () => {
    for (const item of items.filter((i) => i.category === "poll")) expect([item.code, pollProblem(item.pollOptions)]).toEqual([item.code, null]);
  });

  it("pins the welcome posts", () => {
    for (const item of items.filter((i) => i.tag === "welcome")) expect(item.pinDays).toBe(7);
  });
});

describe("parseContentBank", () => {
  it("reads an item, its options and its poll", () => {
    const { items, problems } = parseContentBank(["### S26 · starter · poll · poll 3d", "Biggest issue?", "Poll: Power | Roads | Security"].join("\n"));
    expect(problems).toEqual([]);
    expect(items).toEqual([{ code: "S26", tag: "starter", category: "poll", body: "Biggest issue?", pollOptions: ["Power", "Roads", "Security"], pollDays: 3 }]);
  });

  it("keeps multi-line bodies and stops at the next heading or rule", () => {
    const { items } = parseContentBank(["### W01 · welcome · general · pin 7d", "Line one", "", "Line two", "---", "stray text", "## Section", "### W02 · welcome · general", "Hi"].join("\n"));
    expect(items.map((i) => [i.code, i.body, i.pinDays])).toEqual([
      ["W01", "Line one\n\nLine two", 7],
      ["W02", "Hi", undefined],
    ]);
  });

  it("ignores code blocks (the format example)", () => {
    expect(parseContentBank(["```", "### X01 · starter · general", "Body", "```"].join("\n")).items).toEqual([]);
  });

  it("explains what's wrong instead of guessing", () => {
    const { items, problems } = parseContentBank(
      [
        "### A01 · nonsense · general",
        "x",
        "### A02 · starter · alert",
        "x",
        "### A03 · starter · poll",
        "Only one?",
        "Poll: Yes",
        "### A04 · starter · general · pin 40d",
        "x",
        "### A05 · starter · general",
        "",
        "### A06 · starter · general",
        "x",
        "Poll: A | B",
        "### A07 · starter · general",
        "x",
        "### A07 · starter · general",
        "y",
      ].join("\n"),
    );
    expect(items.map((i) => i.code)).toEqual(["A07"]);
    expect(problems.map((p) => p.problem)).toEqual([
      'Unknown tag "nonsense".',
      `Category "alert" can't be used by the Hood Team.`,
      "Polls need 2 to 4 options.",
      "Pins last 1 to 30 days.",
      "No text.",
      "Has poll options but isn't a poll.",
      "A07 appears twice.",
    ]);
  });
});

describe("filling in a Hood", () => {
  const hood = { name: "Lekki Phase 1", city: "Lagos" };

  it("puts the Hood's name and city in", () => {
    expect(fillTemplate("Hello {hood}, {city}! {hood}", hood)).toBe("Hello Lekki Phase 1, Lagos! Lekki Phase 1");
    expect(fillTemplate("In {city}", { name: "X" })).toBe("In your city");
  });

  it("never lets an unfinished item through", () => {
    expect(needsLocalDetails("Call [FILL: number]")).toBe(true);
    expect(needsLocalDetails("Hi {street}")).toBe(true);
    expect(needsLocalDetails("Hi {hood} in {city}")).toBe(false);
    expect(textForHood({ body: "Police: [FILL: division]" }, hood)).toBeNull();
  });

  it("uses the city's own version when there is one", () => {
    const item = { body: "Light: [FILL: DisCo]", cityVariants: [{ city: "lagos", body: "Light in {hood}: Eko or Ikeja Electric" }] };
    expect(textForHood(item, hood)).toBe("Light in Lekki Phase 1: Eko or Ikeja Electric");
    expect(textForHood(item, { name: "Bodija", city: "Ibadan" })).toBeNull();
  });
});
