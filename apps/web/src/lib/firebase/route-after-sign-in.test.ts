import { describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";

vi.mock("./config", () => ({ auth: {} }));
// The server session is covered in lib/auth/session-sync.test.ts; here it either succeeds or throws.
const requireServerSession = vi.fn(async () => undefined);
vi.mock("@/lib/auth/session-sync", () => ({ requireServerSession: () => requireServerSession() }));

// Only the stored profile matters here; mock mode reads it from the mock store.
const { routeAfterSignIn, updateProfileApi } = await import("./auth");

let n = 0;
async function userWith(profile: Record<string, unknown>): Promise<User> {
  const user = { uid: `route-test-${++n}`, email: "qa@example.com", displayName: "QA" } as unknown as User;
  await updateProfileApi(user, profile as { displayName?: string });
  return user;
}

describe("routeAfterSignIn", () => {
  it("sends staff who aren't residents to the admin when they just logged in", async () => {
    for (const role of ["owner", "admin", "moderator"]) {
      expect(await routeAfterSignIn(await userWith({ role, isOnboarded: false }), "/news-feed")).toBe("/admin");
    }
  });

  it("keeps a staff member's deep link", async () => {
    const user = await userWith({ role: "admin", isOnboarded: false });
    expect(await routeAfterSignIn(user, "/admin/verification")).toBe("/admin/verification");
    expect(await routeAfterSignIn(user, "/p/abc")).toBe("/p/abc");
  });

  it("treats onboarded staff like any resident", async () => {
    expect(await routeAfterSignIn(await userWith({ role: "admin", isOnboarded: true }), "/news-feed")).toBe("/news-feed");
  });

  it("still sends members to onboarding, whatever link they came from", async () => {
    expect(await routeAfterSignIn(await userWith({ role: "member", isOnboarded: false }), "/admin")).toBe("/onboarding");
  });

  it("waits for the server session, and refuses to route anywhere without one", async () => {
    const user = await userWith({ role: "member", isOnboarded: true });
    let ready!: () => void;
    requireServerSession.mockImplementationOnce(() => new Promise<undefined>((r) => (ready = () => r(undefined))));
    let routed: string | null = null;
    const pending = routeAfterSignIn(user, "/news-feed").then((path) => (routed = path));
    await new Promise((r) => setTimeout(r, 10));
    expect(routed).toBeNull();
    ready();
    await pending;
    expect(routed).toBe("/news-feed");

    requireServerSession.mockRejectedValueOnce(new Error("no session"));
    await expect(routeAfterSignIn(user, "/news-feed")).rejects.toThrow("no session");
  });
});
