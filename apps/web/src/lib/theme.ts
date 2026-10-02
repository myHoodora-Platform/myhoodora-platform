import { GUEST_ONLY_PATHS, PUBLIC_PATHS, PUBLIC_PREFIXES, isSessionOnlyPath } from "@/lib/routes";

/**
 * Light / dark theme.
 *
 * - The choice (System, Light, Dark) is per browser, kept in localStorage.
 *   "System" follows the device setting and is the default.
 * - Only the signed-in app, onboarding and the admin are themed. Marketing,
 *   legal and sign-in pages are built around photography and stay light.
 * - The theme is a `dark` class on <html>; globals.css holds both palettes.
 */
export type ThemePreference = "system" | "light" | "dark";
export const THEME_OPTIONS: readonly { id: ThemePreference; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

const STORAGE_KEY = "mh-theme";
const CHANGE_EVENT = "mh-theme-change";

export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system"; // Storage blocked (private mode): follow the device.
  }
}

export function saveThemePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Not saved; it still applies for this visit.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: preference }));
}

const wantsDark = (preference: ThemePreference) =>
  preference === "dark" || (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

/** Puts the right theme on <html> for this page. Returns whether it is dark. */
export function applyTheme(pathname: string, preference = readThemePreference()): boolean {
  const dark = isSessionOnlyPath(pathname) && wantsDark(preference);
  document.documentElement.classList.toggle("dark", dark);
  return dark;
}

/** Calls back when the choice changes (this tab or another) or the device switches theme. */
export function onThemeChange(listener: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && listener();
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  media.addEventListener("change", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", listener);
  };
}

/**
 * Runs in <head> before the first paint, so a dark page never flashes white.
 * The same rule as applyTheme(), written out because it can't import anything;
 * the route lists are injected from lib/routes so the two can't drift apart.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});var d=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var a=location.pathname;var open=${JSON.stringify([...PUBLIC_PATHS, ...GUEST_ONLY_PATHS])};var pre=${JSON.stringify(PUBLIC_PREFIXES)};var themed=open.indexOf(a)<0&&!pre.some(function(x){return a===x||a.indexOf(x+"/")===0});if(d&&themed)document.documentElement.classList.add("dark")}catch(e){}})()`;
