/** Push to the mobile app (docs/api-contract.md §30). */

export type PushPlatform = "ios" | "android";

/** `PUT /push/devices` body. */
export interface RegisterPushDeviceInput {
  token: string;
  platform: PushPlatform;
}

/** The `data` every push carries. `href` is the in-app route, the same path the web uses (e.g. /p/<id>). */
export interface PushData {
  href: string;
  type: string;
  kind?: string;
  subjectId?: string;
}
