import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * The signed-in session, end to end, with a real account against the real
 * API: sign-in, the session cookie, protected routes, themes, sign-out and
 * "sign out everywhere". Needs E2E_EMAIL / E2E_PASSWORD (see
 * playwright.config.ts); without them every test here is skipped.
 *
 * The account is signed out everywhere at the end, so don't point this at an
 * account someone is using.
 */
const EMAIL = process.env.E2E_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const COOKIE = /^(__Host-session|__session)$/;

test.skip(!EMAIL || !PASSWORD, "E2E_EMAIL / E2E_PASSWORD aren't set");
test.describe.configure({ mode: "serial" });

async function signIn(page: Page, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("Email Address").fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 45_000 });
}
const sessionCookie = async (context: BrowserContext) => (await context.cookies()).find((c) => COOKIE.test(c.name));

async function seriousAxeProblems(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.html.slice(0, 150)} :: ${(n.any[0]?.message ?? "").slice(0, 120)}`));
}

/** Signed-in pages hold a live event stream open, so the network never goes idle: wait for the content instead. */
async function settled(page: Page) {
  await page.locator("main").first().waitFor({ state: "visible", timeout: 45_000 });
  await page.waitForTimeout(1500);
}

const SIGNED_IN_PAGES = ["/news-feed", "/settings/account", "/settings/notifications", "/settings/privacy", "/notifications", "/inbox", "/help", "/onboarding", "/admin", "/admin/broadcasts"];

let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
});
test.afterAll(async () => {
  await context.close();
});

test("signing in creates the server session first, then goes to the page that was asked for", async () => {
  const order: string[] = [];
  page.on("response", (r) => {
    if (r.url().endsWith("/api/auth/session")) order.push(`session ${r.status()}`);
  });
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame() && new URL(f.url()).pathname === "/settings/account") order.push("navigated");
  });

  await signIn(page, "/settings/account");
  await expect(page).toHaveURL(/\/settings\/account$/);
  await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
  // The cookie existed before the navigation: no bounce through /login.
  expect(order[0]).toBe("session 200");
  expect(order.indexOf("navigated")).toBeGreaterThan(order.indexOf("session 200"));

  const cookie = await sessionCookie(context);
  expect(cookie, "session cookie").toBeDefined();
  expect(cookie!.httpOnly).toBe(true);
  expect(cookie!.sameSite).toBe("Lax");
  expect(cookie!.path).toBe("/");
  const days = (cookie!.expires - Date.now() / 1000) / 86_400;
  expect(days).toBeGreaterThan(6.9);
  expect(days).toBeLessThanOrEqual(7.01);
  // A Firebase session cookie (a JWT), never readable from page script.
  expect(cookie!.value.split(".")).toHaveLength(3);
  expect(await page.evaluate(() => document.cookie)).not.toMatch(/session=/);
});

test("the session survives a reload, a new tab and the landing page", async () => {
  await page.reload();
  await expect(page).toHaveURL(/\/settings\/account$/);

  const tab = await context.newPage();
  await tab.goto("/");
  // Straight to the feed from the server: the landing page is never shown.
  await expect(tab).toHaveURL(/\/news-feed$/);
  await tab.goto("/login");
  await expect(tab).toHaveURL(/\/news-feed$/);
  await tab.goto("/register");
  await expect(tab).toHaveURL(/\/news-feed$/);
  await tab.close();
});

test("protected pages and the staff-only admin load", async () => {
  for (const path of ["/notifications", "/events", "/inbox", "/help"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("banner")).toBeVisible();
  }
  const admin = await page.goto("/admin");
  expect(admin!.status()).toBe(200);
  expect(admin!.headers()["x-robots-tag"]).toContain("noindex");
  await expect(page.getByRole("link", { name: "Queue" }).first()).toBeVisible({ timeout: 20_000 });
});

test("signed-in pages have no serious accessibility problems", async () => {
  test.setTimeout(180_000);
  const problems: Record<string, string[]> = {};
  for (const path of SIGNED_IN_PAGES) {
    await page.goto(path);
    await settled(page);
    const found = await seriousAxeProblems(page);
    if (found.length) problems[path] = found;
  }
  expect(problems).toEqual({});
});

test("dark theme: chosen in Settings, applied to the app only, remembered, and still readable", async () => {
  test.setTimeout(180_000);
  await page.goto("/settings/account");
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe("rgb(15, 21, 20)");

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");

  const problems: Record<string, string[]> = {};
  for (const path of SIGNED_IN_PAGES) {
    await page.goto(path);
    await settled(page);
    await expect(page.locator("html")).toHaveClass(/dark/);
    const found = await seriousAxeProblems(page);
    if (found.length) problems[path] = found;
  }
  expect(problems).toEqual({});

  // Public pages are light-only, whatever the choice.
  await page.goto("/about");
  await expect(page.locator("html")).not.toHaveClass(/dark/);

  // "System" follows the device.
  await page.goto("/settings/account");
  await page.getByRole("radio", { name: "System" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("the keyboard reaches the main controls, with a visible way to skip to the content", async () => {
  await page.goto("/news-feed");
  await settled(page);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
});

test("logging out ends the session in this browser", async () => {
  await page.goto("/news-feed");
  const calls: string[] = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.pathname.includes("/auth/")) calls.push(`${r.method()} ${url.pathname}`);
  });
  await page.getByRole("banner").getByRole("button").last().click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(await sessionCookie(context)).toBeUndefined();
  // Only this browser's cookie is cleared: nothing is revoked on the API.
  expect(calls.filter((c) => c.includes("logout-everywhere"))).toEqual([]);
  expect(calls).toContain("POST /api/auth/logout");

  await page.goto("/news-feed");
  await expect(page).toHaveURL(/\/login$/);
});

test("sign out everywhere: this browser at once, and another signed-in browser is turned away", async ({ browser }) => {
  test.setTimeout(180_000);
  // A second "device" with its own session.
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signIn(otherPage, "/events");
  await expect(otherPage).toHaveURL(/\/events$/);

  await signIn(page, "/settings/account");
  await page.getByRole("button", { name: "Sign out everywhere" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Sign out everywhere?" })).toBeVisible();
  await dialog.getByRole("button", { name: "Sign out everywhere" }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
  expect(await sessionCookie(context)).toBeUndefined();

  // The other browser still holds a cookie that looks valid, but the session behind it is revoked:
  // it is sent to login (its open tab notices on its next API call; the page gate within a minute).
  await expect
    .poll(
      async () => {
        await otherPage.goto("/events");
        await otherPage.waitForTimeout(1500);
        return new URL(otherPage.url()).pathname;
      },
      { timeout: 120_000, intervals: [3_000] },
    )
    .toBe("/login");
  expect(await sessionCookie(other)).toBeUndefined();
  await other.close();
});

test("after signing out everywhere, signing in again works", async () => {
  await signIn(page);
  expect(await sessionCookie(context)).toBeDefined();
  await page.goto("/notifications");
  await expect(page).toHaveURL(/\/notifications$/);
});
