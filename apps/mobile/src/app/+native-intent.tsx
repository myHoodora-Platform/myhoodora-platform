import { systemPathToRoute } from "@/features/links/system-path";

/** Links from outside the app (Expo Router's native intent hook): features/links/system-path.ts. */
export function redirectSystemPath(input: { path: string; initial: boolean }): string {
  return systemPathToRoute(input);
}
