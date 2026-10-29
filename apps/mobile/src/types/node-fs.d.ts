/**
 * app.config.ts runs in Node at build time, but the app's types are React Native's (no @types/node,
 * which would leak Node globals into app code). This declares the one function it uses.
 */
declare module "node:fs" {
  export function existsSync(path: string): boolean;
}
