import { challengeAdvice, readiness } from "./dashboard-rules";

describe("dashboard rules", () => {
  it("lights a Hood green only with every box ticked", () => {
    expect(readiness({ items: 20, neighbours: 9, leads: 1, welcome: true, moderator: true })).toEqual({ light: "green", missing: [] });
    expect(readiness({ items: 6, neighbours: 3, leads: 0, welcome: true, moderator: false }).light).toBe("amber");
    expect(readiness({ items: 1, neighbours: 1, leads: 0, welcome: false, moderator: false })).toMatchObject({ light: "red", missing: expect.arrayContaining(["a Hood Lead", "a welcome post"]) });
  });

  it("reads the challenge's numbers the way the plan says", () => {
    expect(challengeAdvice([5, 9, 14, 3], 0.2, 0.1).advice).toBe("keep_going");
    expect(challengeAdvice([20, 14, 9, 2], 0.3, 0.1).advice).toBe("consider_ending");
    expect(challengeAdvice([5, 9, 14, 3], 0.85, 0).advice).toBe("consider_ending");
    expect(challengeAdvice([5, 9, 14, 3], 0.1, 0.5).advice).toBe("push_harder");
  });
});
