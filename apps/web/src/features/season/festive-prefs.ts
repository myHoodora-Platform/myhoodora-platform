/** "Festive effects" (Settings → Account → Appearance): on unless someone turns it off on this device. */
const KEY = "mh-festive-effects";
const EVENT = "mh-festive-effects";

export function festiveEffectsOn(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setFestiveEffects(on: boolean): void {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Blocked storage: the switch still works for this page.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function onFestiveEffectsChange(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

/** The greeting card, closed once per season. */
export function greetingDismissed(key: string): boolean {
  try {
    return window.localStorage.getItem(`mh-season-greeting:${key}`) === "1";
  } catch {
    return false;
  }
}

export function dismissGreeting(key: string): void {
  try {
    window.localStorage.setItem(`mh-season-greeting:${key}`, "1");
  } catch {
    // ignore
  }
}
