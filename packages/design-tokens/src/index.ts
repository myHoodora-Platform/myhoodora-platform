/**
 * myHoodora design tokens. Sources: brand/myhoodora_brand_system/08_Guidelines/myhoodora_palette.json
 * (brand) and apps/web/src/app/globals.css (semantic, light and dark). The web keeps its CSS
 * variables; apps/web/src/app/design-tokens.test.ts fails if the two drift apart.
 *
 * Use the semantic names in screens, never raw hex values.
 */

export const brand = {
  teal: "#147c73",
  coral: "#ff6b5b",
  /** Coral for text: the brand coral is too light to read as small text. */
  coralInk: "#a62c1d",
  gray: "#f2f2f2",
  ink: "#1b2b29",
} as const;

export interface ColorTokens {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  dangerSoft: string;
  /** Behind cards. */
  canvas: string;
  border: string;
  input: string;
  /** Focus ring. */
  ring: string;
}

export const light: ColorTokens = {
  background: "#ffffff",
  foreground: "#171717",
  card: "#ffffff",
  cardForeground: "#171717",
  popover: "#ffffff",
  popoverForeground: "#171717",
  primary: "#11706a",
  primaryForeground: "#ffffff",
  secondary: "#f2f2f2",
  secondaryForeground: "#171717",
  muted: "#f2f2f2",
  mutedForeground: "#696969",
  accent: "#f2f2f2",
  accentForeground: "#171717",
  destructive: "#dc2626",
  destructiveForeground: "#ffffff",
  success: "#15803d",
  successSoft: "#dcfce7",
  warning: "#b45309",
  warningSoft: "#fef3c7",
  info: "#1d4ed8",
  infoSoft: "#dbeafe",
  dangerSoft: "#fee2e2",
  canvas: "#f4f5f4",
  border: "#e5e7eb",
  input: "#e5e7eb",
  ring: "#11706a",
};

export const dark: ColorTokens = {
  background: "#0f1514",
  foreground: "#e8eeec",
  card: "#171e1d",
  cardForeground: "#e8eeec",
  popover: "#1b2322",
  popoverForeground: "#e8eeec",
  primary: "#3ebdb0",
  primaryForeground: "#052b27",
  secondary: "#222b2a",
  secondaryForeground: "#e8eeec",
  muted: "#222b2a",
  mutedForeground: "#a3b0ad",
  accent: "#26302e",
  accentForeground: "#e8eeec",
  destructive: "#ef4444",
  destructiveForeground: "#ffffff",
  success: "#4ade80",
  successSoft: "#12301f",
  warning: "#fbbf24",
  warningSoft: "#3a2a0b",
  info: "#7fb0ff",
  infoSoft: "#16264a",
  dangerSoft: "#3b1717",
  canvas: "#0b100f",
  border: "#2b3533",
  input: "#2b3533",
  ring: "#3ebdb0",
};

/** Outfit throughout. h1/h2 700 · h3, buttons, labels 600 · body 400 (globals.css @theme). */
export const fontWeight = { body: "400", strong: "600", subhead: "600", heading: "700", display: "700" } as const;

/** Tailwind's scale as the web uses it (text-[11px], text-sm, text-base, text-lg, text-xl, text-2xl). */
export const fontSize = { xs: 11, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24 } as const;

/** Tailwind's 4 px spacing scale. */
export const space = { 0: 0, 0.5: 2, 1: 4, 1.5: 6, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;

/** rounded-xl buttons and inputs · rounded-2xl cards · rounded-full pills. */
export const radius = { sm: 6, md: 8, lg: 10, xl: 12, "2xl": 16, full: 9999 } as const;
