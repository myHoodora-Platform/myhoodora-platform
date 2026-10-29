import { deleteBackward, insertAt } from "../emoji-text";

describe("the emoji keyboard's delete key", () => {
  it("removes a whole emoji, however many code points it is", () => {
    expect(deleteBackward("hi 👍").text).toBe("hi ");
    expect(deleteBackward("hi 👍🏽").text).toBe("hi ");
    expect(deleteBackward("ok 👨‍👩‍👧").text).toBe("ok ");
    expect(deleteBackward("❤️").text).toBe("");
    expect(deleteBackward("1️⃣").text).toBe("");
    expect(deleteBackward("go 🇳🇬").text).toBe("go ");
    expect(deleteBackward("🇳🇬🇬🇭").text).toBe("🇳🇬");
  });

  it("removes plain letters one at a time, and only before the cursor", () => {
    expect(deleteBackward("abc")).toEqual({ text: "ab", cursor: 2 });
    expect(deleteBackward("ab👍cd", 4)).toEqual({ text: "abcd", cursor: 2 });
    expect(deleteBackward("", 0)).toEqual({ text: "", cursor: 0 });
  });
});

it("inserts at the cursor, replacing a selection", () => {
  expect(insertAt("hello", "😀", { start: 5, end: 5 })).toEqual({ text: "hello😀", cursor: 7 });
  expect(insertAt("hello", "😀", { start: 0, end: 5 })).toEqual({ text: "😀", cursor: 2 });
  expect(insertAt("hi", "😀", { start: 9, end: 9 })).toEqual({ text: "hi😀", cursor: 4 });
});
