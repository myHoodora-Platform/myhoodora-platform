import { afterEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_PATHS, GUEST_ONLY_PATHS, isSessionOnlyPath } from "./routes";
import { THEME_BOOT_SCRIPT, applyTheme, readThemePreference, saveThemePreference } from "./theme";

function fakeBrowser({ stored, deviceDark, pathname = "/news-feed" }: { stored?: string; deviceDark: boolean; pathname?: string }) {
  const classes = new Set<string>();
  const store = new Map<string, string>(stored ? [["mh-theme", stored]] : []);
  const classList = {
    toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)),
    add: (name: string) => classes.add(name),
    contains: (name: string) => classes.has(name),
  };
  const localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  const matchMedia = () => ({ matches: deviceDark, addEventListener: () => undefined, removeEventListener: () => undefined });
  vi.stubGlobal("window", { localStorage, matchMedia, dispatchEvent: () => true });
  vi.stubGlobal("document", { documentElement: { classList } });
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("matchMedia", matchMedia);
  vi.stubGlobal("location", { pathname });
  vi.stubGlobal("CustomEvent", class { constructor(public type: string, public init?: unknown) {} });
  return { classes, store };
}
afterEach(() => vi.unstubAllGlobals());

describe("theme preference", () => {
  it("defaults to following the device, and remembers an explicit choice", () => {
    const { store } = fakeBrowser({ deviceDark: true });
    expect(readThemePreference()).toBe("system");
    saveThemePreference("dark");
    expect(readThemePreference()).toBe("dark");
    saveThemePreference("system");
    expect(store.has("mh-theme")).toBe(false);
  });

  it("is dark only when wanted *and* on a signed-in page", () => {
    fakeBrowser({ deviceDark: true });
    expect(applyTheme("/news-feed")).toBe(true);
    expect(applyTheme("/admin/hoods")).toBe(true);
    // Marketing, legal and sign-in pages are light-only, whatever the choice.
    for (const path of ["/", "/about", "/login", "/register", "/privacy", "/business/get-started"]) expect(applyTheme(path, "dark")).toBe(false);
    expect(applyTheme("/news-feed", "light")).toBe(false);
  });
});

describe("the before-paint script agrees with applyTheme", () => {
  const boot = (opts: Parameters<typeof fakeBrowser>[0]) => {
    const { classes } = fakeBrowser(opts);
    new Function(THEME_BOOT_SCRIPT)();
    return classes.has("dark");
  };

  it("for every kind of page and choice", () => {
    const paths = ["/", "/about", "/login", "/forgot-password", "/business", "/business/claim", "/coming-soon/marketplace", "/news-feed", "/p/abc", "/onboarding", "/admin", "/settings/account"];
    for (const pathname of paths) {
      for (const stored of [undefined, "light", "dark"]) {
        for (const deviceDark of [true, false]) {
          const expected = isSessionOnlyPath(pathname) && (stored === "dark" || (stored !== "light" && deviceDark));
          expect(boot({ stored, deviceDark, pathname }), `${pathname} stored=${stored} device=${deviceDark}`).toBe(expected);
        }
      }
    }
  });

  it("carries the same route lists as lib/routes (so the two can't drift)", () => {
    for (const path of [...PUBLIC_PATHS, ...GUEST_ONLY_PATHS]) expect(THEME_BOOT_SCRIPT).toContain(JSON.stringify(path));
  });

  it("never throws, even with storage blocked", () => {
    fakeBrowser({ deviceDark: true });
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); } });
    expect(() => new Function(THEME_BOOT_SCRIPT)()).not.toThrow();
  });
});
