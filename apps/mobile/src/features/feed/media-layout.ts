import { clampAspect } from "@/shared/ui/photo-pager";

/** One tile of a photo grid, in fractions of the grid's width and height. */
export interface Tile {
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GridLayout {
  /** Width ÷ height of the whole grid. */
  aspect: number;
  tiles: Tile[];
  /** Photos not shown ("+N" on the last tile). */
  hidden: number;
}

/**
 * How a post's photos sit in the feed: one keeps its own shape (between 1.91:1 and 4:5); two side by
 * side; three as one large and two small (beside a tall one, under a wide one); four or more as a 2×2
 * grid with "+N" on the last tile.
 */
export function gridLayout(aspects: readonly (number | null | undefined)[], count: number): GridLayout {
  if (count <= 0) return { aspect: 1, tiles: [], hidden: 0 };
  if (count === 1) return { aspect: clampAspect(aspects[0]), tiles: [{ index: 0, x: 0, y: 0, w: 1, h: 1 }], hidden: 0 };
  if (count === 2) {
    return {
      aspect: 1,
      tiles: [
        { index: 0, x: 0, y: 0, w: 0.5, h: 1 },
        { index: 1, x: 0.5, y: 0, w: 0.5, h: 1 },
      ],
      hidden: 0,
    };
  }
  if (count === 3) {
    const wide = (aspects[0] ?? 1) > 1.1;
    return wide
      ? {
          aspect: 1,
          tiles: [
            { index: 0, x: 0, y: 0, w: 1, h: 0.6 },
            { index: 1, x: 0, y: 0.6, w: 0.5, h: 0.4 },
            { index: 2, x: 0.5, y: 0.6, w: 0.5, h: 0.4 },
          ],
          hidden: 0,
        }
      : {
          aspect: 1,
          tiles: [
            { index: 0, x: 0, y: 0, w: 0.6, h: 1 },
            { index: 1, x: 0.6, y: 0, w: 0.4, h: 0.5 },
            { index: 2, x: 0.6, y: 0.5, w: 0.4, h: 0.5 },
          ],
          hidden: 0,
        };
  }
  return {
    aspect: 1,
    tiles: [0, 1, 2, 3].map((i) => ({ index: i, x: (i % 2) * 0.5, y: Math.floor(i / 2) * 0.5, w: 0.5, h: 0.5 })),
    hidden: count - 4,
  };
}
