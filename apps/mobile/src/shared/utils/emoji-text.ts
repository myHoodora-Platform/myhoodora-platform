/** Code points that join onto the one before them in an emoji: ZWJ, variation selectors, skin tones, keycap, tags. */
function joins(cp: number): boolean {
  return cp === 0x200d || cp === 0xfe0f || cp === 0xfe0e || cp === 0x20e3 || (cp >= 0x1f3fb && cp <= 0x1f3ff) || (cp >= 0xe0020 && cp <= 0xe007f);
}

const isRegionalIndicator = (cp: number) => cp >= 0x1f1e6 && cp <= 0x1f1ff;

/**
 * The emoji keyboard's ⌫: removes the last character before `cursor`, a whole emoji at a time
 * ("👨‍👩‍👧", "👍🏽", "🇳🇬" are one press, as on WhatsApp), not half of one.
 */
export function deleteBackward(text: string, cursor = text.length): { text: string; cursor: number } {
  const before = Array.from(text.slice(0, cursor));
  if (!before.length) return { text, cursor };
  let start = before.length - 1;
  // Walk back over joiners and what they join: "👨 ZWJ 👩 ZWJ 👧", "👍 🏽", "1 FE0F 20E3".
  while (start > 0) {
    const cp = before[start]!.codePointAt(0)!;
    const prev = before[start - 1]!.codePointAt(0)!;
    if (joins(cp) || prev === 0x200d) start -= 1;
    else break;
  }
  // A flag is two regional indicators.
  const cp = before[start]!.codePointAt(0)!;
  if (isRegionalIndicator(cp) && start > 0 && isRegionalIndicator(before[start - 1]!.codePointAt(0)!)) {
    // Pairs from the start of the run: an odd count means the last one is a lone half.
    let run = 0;
    for (let i = start - 1; i >= 0 && isRegionalIndicator(before[i]!.codePointAt(0)!); i--) run++;
    if (run % 2 === 1) start -= 1;
  }
  const kept = before.slice(0, start).join("");
  return { text: kept + text.slice(cursor), cursor: kept.length };
}

/** `insert` at the cursor (replacing a selection). */
export function insertAt(text: string, insert: string, selection: { start: number; end: number }): { text: string; cursor: number } {
  const start = Math.min(selection.start, text.length);
  const end = Math.min(Math.max(selection.end, start), text.length);
  return { text: text.slice(0, start) + insert + text.slice(end), cursor: start + insert.length };
}
