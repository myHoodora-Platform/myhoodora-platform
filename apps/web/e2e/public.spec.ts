import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Everything a signed-out visitor can reach. Needs only the web app: no API
 * and no account, so it runs anywhere (including CI).
 */

/** Console errors and CSP violations seen while a test runs; a page that logs either is broken. */
function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    // The API isn't running in these tests; a failed profile/API call is expected noise, a policy violation is not.
    if (msg.type() === "error" && /Content Security Policy|Refused to|hydrat/i.test(text)) problems.push(text);
  });
  page.on("pageerror", (err) => problems.push(String(err)));
  return problems;
}

test.describe("landing page (signed out)", () => {
  test("shows the sign-in choices, sends the security headers and makes no auth requests", async ({ page }) => {
    const problems = watchConsole(page);
    const authCalls: string[] = [];
    page.on("request", (r) => r.url().includes("/api/auth/") && authCalls.push(`${r.method()} ${new URL(r.url()).pathname}`));

    const response = await page.goto("/");
    expect(response!.status()).toBe(200);
    const headers = response!.headers();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["strict-transport-security"]).toContain("max-age=");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");

    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Sign up" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    // Apple sign-in is switched off until it is set up.
    await expect(page.getByRole("button", { name: /Apple/i })).toHaveCount(0);

    await page.waitForLoadState("networkidle");
    // A visitor who was never signed in has no session to create or clear.
    expect(authCalls).toEqual([]);
    expect(problems).toEqual([]);
  });

  test("the Marketplace link says it is coming, and leads to a page that says so too", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("banner").getByRole("link", { name: /Marketplace/ }).first();
    await expect(link).toContainText(/soon/i);
    await link.click();
    await expect(page).toHaveURL(/\/coming-soon\/marketplace$/);
    await expect(page.getByText(/coming soon/i).first()).toBeVisible();
  });
});

test.describe("protected routes without a session", () => {
  for (const [path, expected] of [
    ["/news-feed", "/login"],
    ["/p/abc123", "/login?next=%2Fp%2Fabc123"],
    ["/events", "/login?next=%2Fevents"],
    ["/settings/account", "/login?next=%2Fsettings%2Faccount"],
    ["/onboarding", "/login?next=%2Fonboarding"],
    ["/admin", "/login?next=%2Fadmin"],
    ["/dashboard", "/login"], // old link → /news-feed → login
  ] as const) {
    test(`${path} → ${expected}`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL((url) => url.pathname + url.search === expected);
      await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    });
  }

  test("a forged session cookie is not a session", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "__session", value: "not.a.real-cookie", url: baseURL! }]);
    await page.goto("/news-feed");
    await expect(page).toHaveURL(/\/login$/);
    // …and the proxy removed it. (A production build reads `__Host-session`, so a cookie called `__session` is simply ignored there.)
    if (!process.env.E2E_BASE_URL) expect((await context.cookies()).find((c) => c.name === "__session")).toBeUndefined();
  });

  test("an off-site ?next= is ignored", async ({ page }) => {
    await page.goto("/login?next=https://evil.example/phish");
    await expect(page).toHaveURL(/\/login\?next=/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  });
});

test.describe("sign-in and sign-up forms", () => {
  test("login validates before calling anything", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel("Email Address").fill("not-an-email");
    await page.getByLabel("Password", { exact: true }).fill("x");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByLabel("Email Address")).toHaveAttribute("aria-invalid", "true");
  });

  test("a wrong password keeps you on the login page with a clear message", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email Address").fill("e2e-nobody@example.com");
    await page.getByLabel("Password", { exact: true }).fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.locator("[data-sonner-toast]").first()).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("Email Address")).toBeVisible();
  });

  test("the password can be shown and hidden from the keyboard", async ({ page }) => {
    await page.goto("/login");
    const password = page.getByLabel("Password", { exact: true });
    await password.fill("secret-value");
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("register requires a valid email, a strong enough password and the terms", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Email Address").fill("new-neighbour@example.com");
    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test("forgot password asks for an email", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByLabel("Email Address")).toBeVisible();
    await page.getByRole("button", { name: /send|reset/i }).first().click();
    await expect(page.getByRole("alert").first()).toBeVisible();
  });

  test("a reset or verification link without a valid code says so instead of breaking", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByText(/invalid|expired|request a new/i).first()).toBeVisible();
    await page.goto("/verify-email?token=obviously-not-a-real-token-1234567890");
    await expect(page.getByText(/couldn't|invalid|expired|try again|problem/i).first()).toBeVisible();
  });
});

test.describe("Google sign-in", () => {
  test("the button opens Google's own sign-in window; closing it is not an error", async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(!process.env.NEXT_PUBLIC_FIREBASE_API_KEY, "the Firebase web config isn't set for this run");
    await page.goto("/login");
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    const popup = await popupPromise;
    // "commit", not "load": we only need to know where it went, and Google's page can be slow to finish loading.
    await popup.waitForURL(/accounts\.google\.com/, { timeout: 60_000, waitUntil: "commit" });
    const google = new URL(popup.url());
    // Identity only (no Drive, Calendar, Gmail…), and the account chooser is always offered.
    expect(google.searchParams.get("scope")?.split(" ").sort()).toEqual(["https://www.googleapis.com/auth/userinfo.email", "openid", "profile"]);
    expect(google.searchParams.get("prompt")).toBe("select_account");
    await popup.close();
    // Cancelling is silent: still on the form, no error toast.
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeEnabled({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("[data-sonner-toast][data-type=error]")).toHaveCount(0);
  });

  test("One Tap is requested from Google for signed-out visitors, within the content policy", async ({ page }) => {
    test.skip(!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID, "NEXT_PUBLIC_GOOGLE_CLIENT_ID isn't set for this run");
    const problems = watchConsole(page);
    const gsi = page.waitForRequest((r) => r.url().startsWith("https://accounts.google.com/gsi/client"), { timeout: 20_000 });
    await page.goto("/");
    await gsi;
    await page.waitForTimeout(1500);
    expect(problems).toEqual([]);
  });
});

test.describe("search engines and link previews", () => {
  test("robots.txt keeps crawlers out of the signed-in app and points at the sitemap", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /news-feed");
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);
  });

  test("the sitemap lists public pages only", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    for (const path of ["/about", "/privacy", "/terms", "/business"]) expect(sitemap).toContain(`${path}</loc>`);
    for (const path of ["/news-feed", "/admin", "/settings", "/onboarding"]) expect(sitemap).not.toContain(path);
  });

  test("a public page has its own title, canonical URL and preview card", async ({ page }) => {
    await page.goto("/about");
    await expect(page).toHaveTitle("About myHoodora");
    expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toMatch(/\/about$/);
    expect(await page.locator('meta[property="og:title"]').getAttribute("content")).toBe("About myHoodora");
    expect(await page.locator('meta[property="og:image"]').getAttribute("content")).toMatch(/^https?:\/\/.+\/og\/og-teal\.png$/);
    expect(await page.locator('meta[name="twitter:card"]').getAttribute("content")).toBe("summary_large_image");
  });
});

test.describe("accessibility (axe: no serious or critical problems)", () => {
  for (const path of ["/", "/login", "/register", "/forgot-password", "/about", "/privacy", "/contact"]) {
    test(path, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(blocking.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    });
  }

  test("the public site stays light even when the device prefers dark", async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: "dark" });
    const page = await context.newPage();
    await page.goto("/login");
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await context.close();
  });
});
