import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { brand, dark, light, type ColorTokens } from "@myhoodora/design-tokens";
import { describe, expect, it } from "vitest";

/**
 * The mobile app takes its colours from @myhoodora/design-tokens; the web from the CSS variables
 * here. A colour changed in one place and not the other fails this test.
 */
const css = readFileSync(fileURLToPath(new URL("./globals.css", import.meta.url)), "utf8");

/** `--name: #hex;` declarations inside the first block whose selector starts with `selector`. */
function variables(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const block = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{3,8})\s*;/gi)].map((m) => [m[1]!, m[2]!.toLowerCase()]));
}

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const asCss = (tokens: ColorTokens) => Object.fromEntries(Object.entries(tokens).map(([k, v]) => [kebab(k), v]));

describe("design tokens match globals.css", () => {
  it("light theme", () => {
    const vars = variables(":root,");
    expect(Object.fromEntries(Object.keys(asCss(light)).map((k) => [k, vars[k]]))).toEqual(asCss(light));
  });

  it("dark theme", () => {
    const vars = variables(".dark {");
    expect(Object.fromEntries(Object.keys(asCss(dark)).map((k) => [k, vars[k]]))).toEqual(asCss(dark));
  });

  it("brand colours", () => {
    const vars = variables(":root,");
    expect({ teal: vars["brand-teal"], coral: vars["brand-coral"], coralInk: vars["brand-coral-ink"], gray: vars["brand-gray"], ink: vars["brand-ink"] }).toEqual(brand);
  });
});
