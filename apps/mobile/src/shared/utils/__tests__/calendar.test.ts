import { monthGrid } from "../calendar";

it("lays a month out in Monday-first weeks", () => {
  // November 2026 starts on a Sunday and has 30 days.
  const weeks = monthGrid(2026, 10);
  expect(weeks[0]!.slice(0, 6)).toEqual([null, null, null, null, null, null]);
  expect(weeks[0]![6]!.getDate()).toBe(1);
  expect(weeks.flat().filter(Boolean)).toHaveLength(30);
  expect(weeks.every((w) => w.length === 7)).toBe(true);
});
