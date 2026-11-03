import { firstName, formatNaira } from "../format";

it("formats naira as the web does, with Free for null", () => {
  expect(formatNaira(null)).toBe("Free");
  expect(formatNaira(0)).toBe("₦0");
  expect(formatNaira(950)).toBe("₦950");
  expect(formatNaira(25000)).toBe("₦25,000");
  expect(formatNaira(1200000)).toBe("₦1,200,000");
});

it("takes a first name for greetings", () => {
  expect(firstName("Ada Okafor")).toBe("Ada");
  expect(firstName(undefined)).toBe("");
});
