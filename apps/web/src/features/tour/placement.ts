export type TourSide = "top" | "right" | "bottom";

interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface Viewport {
  width: number;
  height: number;
}

/** Desktop layout breakpoint (Tailwind `lg`), where the left sidebar replaces the bottom tab bar. */
const SIDEBAR_MIN_WIDTH = 1024;

/**
 * Which side of the target the card should prefer. Radix still flips/shifts it
 * when that side runs out of room; this just picks the natural first choice:
 * above anything low on screen (the mobile tab bar), beside the desktop
 * sidebar, and below everything else.
 */
export function preferredSide(target: Box, viewport: Viewport): TourSide {
  if (target.top > viewport.height * 0.6) return "top";
  if (viewport.width >= SIDEBAR_MIN_WIDTH && target.right < viewport.width * 0.3) return "right";
  return "bottom";
}

/**
 * Room kept clear at the top and bottom of the viewport for the sticky header
 * (64–72px) and the mobile tab bar (64px), so a target that sits under either
 * still counts as hidden.
 */
export const SAFE_EDGE_PX = 80;

/** Whether a scrolling target needs scrolling to be clearly visible. */
export function needsScroll(target: Box, viewport: Viewport, edge = SAFE_EDGE_PX): boolean {
  return target.top < edge || target.bottom > viewport.height - edge;
}

/** `data-tour` id for a main-nav link; the sidebar and the mobile tab bar share it. */
export const navTourId = (href: string) => `nav${href}`;

export const tourSelector = (id: string) => `[data-tour="${id}"]`;

/**
 * The visible element tagged with this tour id. Several can exist at once
 * (the sidebar and the mobile tab bar both link to Alerts, one of them
 * display:none at any width), so the first one actually laid out wins.
 */
export function findTourTarget(id: string, root: ParentNode = document): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>(tourSelector(id))) {
    if (el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden") return el;
  }
  return null;
}

/** Inside a fixed or sticky container (header, sidebar, tab bar): scrolling the page won't move it. */
export function isPinned(el: HTMLElement): boolean {
  for (let node: HTMLElement | null = el; node && node !== document.body; node = node.parentElement) {
    const { position } = getComputedStyle(node);
    if (position === "fixed" || position === "sticky") return true;
  }
  return false;
}
