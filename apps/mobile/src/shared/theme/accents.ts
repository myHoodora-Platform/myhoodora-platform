/**
 * Named colours the API sends by name (ad announcements, feedback prompts), as [background,
 * foreground] for light and dark. The web admin's previews use the light pair.
 */
export const ACCENTS = {
  green: { light: ["#E7F4EE", "#0F5132"], dark: ["#12352A", "#BFE8D4"] },
  blue: { light: ["#E8F0FE", "#1E3A8A"], dark: ["#172554", "#BFD3FE"] },
  amber: { light: ["#FEF3C7", "#92400E"], dark: ["#3B2A0A", "#FDE68A"] },
  rose: { light: ["#FFE4E6", "#9F1239"], dark: ["#3F1220", "#FECDD3"] },
  slate: { light: ["#F1F5F9", "#334155"], dark: ["#1E293B", "#CBD5E1"] },
} as const satisfies Record<string, { light: readonly [string, string]; dark: readonly [string, string] }>;

export type AccentName = keyof typeof ACCENTS;

export function accent(name: string | undefined, scheme: "light" | "dark"): readonly [string, string] {
  return (ACCENTS[(name ?? "green") as AccentName] ?? ACCENTS.green)[scheme];
}
