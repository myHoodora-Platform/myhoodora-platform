import type { User } from "@firebase/auth";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { apiFetch } from "@/core/api/client";

/** What the API stores photos for (contract §20). */
export type MediaPurpose = "post" | "listing" | "group" | "avatar";

export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
}

export interface UploadedMedia {
  id: string;
  url: string;
}

/** The API keeps at most 2560 px; 2048 is plenty on any phone and roughly halves the upload on mobile data. */
export const MAX_EDGE = 2048;
/** A photo on slow mobile data can take a while; the default 15 s is for ordinary requests. */
const UPLOAD_TIMEOUT_MS = 120_000;

export type PickResult = { ok: true; photos: PickedPhoto[] } | { ok: false; reason: "cancelled" | "denied" };

/** The phone's photo picker (no permission prompt on iOS 14+ or Android 13+: the person picks). */
export async function pickPhotos(limit: number): Promise<PickResult> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: limit > 1, selectionLimit: limit, quality: 1, exif: false });
  if (result.canceled) return { ok: false, reason: "cancelled" };
  return { ok: true, photos: result.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height })) };
}

/** The camera, asked for only when someone taps "Take a photo". */
export async function takePhoto(): Promise<PickResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { ok: false, reason: "denied" };
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1, exif: false });
  if (result.canceled) return { ok: false, reason: "cancelled" };
  const a = result.assets[0]!;
  return { ok: true, photos: [{ uri: a.uri, width: a.width, height: a.height }] };
}

/** The size to send: the long edge at most MAX_EDGE, the shape kept. Null when it's already small enough. */
export function resizeFor({ width, height }: { width: number; height: number }): { width: number } | { height: number } | null {
  if (Math.max(width, height) <= MAX_EDGE) return null;
  return width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE };
}

/** A JPEG at most MAX_EDGE on its long edge, without camera metadata. */
export async function preparePhoto(photo: PickedPhoto): Promise<string> {
  const context = ImageManipulator.manipulate(photo.uri);
  const size = resizeFor(photo);
  if (size) context.resize(size);
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
  return saved.uri;
}

/** `POST /media` (multipart): the API checks the real type, resizes and strips metadata again. */
export async function uploadPhoto(user: User, uri: string, purpose: MediaPurpose): Promise<UploadedMedia> {
  const form = new FormData();
  // React Native's FormData takes a file as { uri, name, type }.
  form.append("file", { uri, name: "photo.jpg", type: "image/jpeg" } as unknown as Blob);
  form.append("purpose", purpose);
  return apiFetch<UploadedMedia>(user, "/media", { method: "POST", body: form, timeoutMs: UPLOAD_TIMEOUT_MS });
}

/** Best effort: a photo removed from a draft before posting. */
export async function deleteMedia(user: User, id: string): Promise<void> {
  await apiFetch<void>(user, `/media/${id}`, { method: "DELETE" }).catch(() => undefined);
}
