export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Room around the highlighted element, so the outline doesn't touch it. */
export const SPOTLIGHT_PAD = 6;

/** The highlighted area: the element plus padding, kept on screen. */
export function spotlight(target: Rect, screen: { width: number; height: number }, pad = SPOTLIGHT_PAD): Rect {
  const x = Math.max(4, target.x - pad);
  const y = Math.max(4, target.y - pad);
  const right = Math.min(screen.width - 4, target.x + target.width + pad);
  const bottom = Math.min(screen.height - 4, target.y + target.height + pad);
  return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
}

/** Usable only if some of it is on screen and it has a size (a hidden tab measures as zero). */
export function isOnScreen(r: Rect, screen: { width: number; height: number }): boolean {
  return r.width > 1 && r.height > 1 && r.y + r.height > 0 && r.y < screen.height && r.x + r.width > 0 && r.x < screen.width;
}

/**
 * Where the step's card goes: below the spotlight when there's more room there, otherwise above it.
 * Returned as a distance from the top or from the bottom of the screen.
 */
export function cardPlacement(spot: Rect, screen: { height: number }, gap = 14): { top: number } | { bottom: number } {
  const above = spot.y;
  const below = screen.height - (spot.y + spot.height);
  return below >= above ? { top: spot.y + spot.height + gap } : { bottom: screen.height - spot.y + gap };
}

/** An SVG path covering the screen with a rounded hole over `r` (draw with fillRule "evenodd"). */
export function holePath(r: Rect, screen: { width: number; height: number }, radius = 16): string {
  const rad = Math.min(radius, r.width / 2, r.height / 2);
  const { x, y, width: w, height: h } = r;
  return [
    `M0 0H${screen.width}V${screen.height}H0Z`,
    `M${x + rad} ${y}H${x + w - rad}A${rad} ${rad} 0 0 1 ${x + w} ${y + rad}V${y + h - rad}A${rad} ${rad} 0 0 1 ${x + w - rad} ${y + h}`,
    `H${x + rad}A${rad} ${rad} 0 0 1 ${x} ${y + h - rad}V${y + rad}A${rad} ${rad} 0 0 1 ${x + rad} ${y}Z`,
  ].join("");
}
