import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Reads the web app's TypeScript view types (the contract the frontend was
 * built against) and returns each interface's REQUIRED top-level keys,
 * following `extends`. Deliberately tiny: top-level `name: type;` lines only.
 */
export function requiredKeys(...files: string[]): (name: string) => string[] {
  const src = files.map((f) => readFileSync(join(__dirname, "../../../web/src/lib/api", f), "utf8")).join("\n");
  const shapes = new Map<string, { parents: string[]; keys: string[] }>();
  const re = /export interface (\w+)(?:<[^>]*>)?(?: extends ([\w\s,<>]+))? \{\n([\s\S]*?)\n\}/g;
  for (const m of src.matchAll(re)) {
    const keys = [...m[3]!.matchAll(/^ {2}(\w+):/gm)].map((k) => k[1]!);
    const parents = (m[2] ?? "").split(",").map((p) => p.replace(/<.*>/, "").trim()).filter(Boolean);
    shapes.set(m[1]!, { parents, keys });
  }
  const resolve = (name: string): string[] => {
    const s = shapes.get(name);
    if (!s) throw new Error(`web type ${name} not found in ${files.join(", ")}`);
    return [...new Set([...s.parents.flatMap((p) => (shapes.has(p) ? resolve(p) : [])), ...s.keys])];
  };
  return resolve;
}

/** Keys the web type requires that the API response lacks. */
export function missingKeys(obj: Record<string, unknown>, keys: string[]): string[] {
  return keys.filter((k) => !(k in obj));
}
