import type { User } from "firebase/auth";
import { ApiError, apiFetch, apiUpload } from "./client";
import { isLive } from "./config";

/** Where an upload will be used; the API picks the folder and allowed types from it. */
export type MediaPurpose = "post" | "listing" | "group" | "avatar";

export interface UploadedMedia {
  id: string;
  url: string;
  resourceType: "image" | "video";
  width?: number;
  height?: number;
  durationSeconds?: number;
}

const MB = 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
export const PHOTO_ACCEPT = PHOTO_TYPES.join(",");
export const MEDIA_ACCEPT = [...PHOTO_TYPES, ...VIDEO_TYPES].join(",");
/** Same limits as the API (contract §20). The API streams videos to disk and on to storage, so they can be bigger than photos. */
export const MEDIA_LIMITS = { photoBytes: 10 * MB, videoBytes: 100 * MB, videoSeconds: 60 } as const;
/** A 100 MB clip on slow mobile data can take many minutes; don't give up early (the API allows 20). */
const DIRECT_UPLOAD_TIMEOUT_MS = 20 * 60_000;

/** Signed permission to upload one file straight to storage (from POST /media/direct). */
interface DirectUploadTicket {
  url: string;
  fields: Record<string, string>;
  fileField: string;
  expiresAt: string;
}

export const isVideoFile = (file: File) => VIDEO_TYPES.includes(file.type);

/** Same rules the API enforces, checked first so people get instant feedback. */
export function checkPhoto(file: File): string | null {
  if (!PHOTO_TYPES.includes(file.type)) return "Choose a photo (JPG, PNG, WebP, GIF or HEIC).";
  if (file.size > MEDIA_LIMITS.photoBytes) return "Photos must be under 10 MB.";
  return null;
}

/** Reads a video's length in the browser (no upload needed). null if the browser can't tell. */
export function videoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    const done = (d: number | null) => {
      URL.revokeObjectURL(url);
      resolve(d);
    };
    v.preload = "metadata";
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) ? v.duration : null);
    v.onerror = () => done(null);
    setTimeout(() => done(null), 5000);
    v.src = url;
  });
}

/** Photo or (posts only) video. The duration check needs the browser, so it's async. */
export async function checkMedia(file: File): Promise<string | null> {
  if (!isVideoFile(file)) return PHOTO_TYPES.includes(file.type) ? checkPhoto(file) : "Choose a photo, or an MP4, MOV or WebM video.";
  // Phones record 1080p at roughly 2 MB a second, so a long or 4K clip goes over; say what to do about it.
  if (file.size > MEDIA_LIMITS.videoBytes) return "Videos must be under 100 MB. Try a shorter clip, or record at 1080p instead of 4K.";
  const seconds = await videoDuration(file);
  if (seconds !== null && seconds > MEDIA_LIMITS.videoSeconds + 0.5) return `Videos can be up to ${MEDIA_LIMITS.videoSeconds} seconds long.`;
  return null;
}

/**
 * live: POST /media (multipart: file + purpose) → { id, url, resourceType, … }.
 * The API stores it with the configured provider (Cloudinary today); the web
 * app never sees provider credentials. Contract §20.
 */
export async function uploadMedia(
  user: User,
  file: File,
  purpose: MediaPurpose,
  onProgress?: (fraction: number) => void,
): Promise<UploadedMedia> {
  const video = isVideoFile(file);
  const problem = video ? (purpose === "post" ? null : "Only photos can be added here.") : checkPhoto(file);
  if (problem) throw new ApiError(problem, 400, "client");
  if (!isLive("media")) {
    // Mock mode: a local preview URL for this tab only.
    return { id: `mock-${crypto.randomUUID()}`, url: URL.createObjectURL(file), resourceType: video ? "video" : "image" };
  }
  if (video && isLive("media.direct")) {
    // Large videos go straight to storage with a one-time signed ticket, so they never pass through
    // (and fill the memory of) the API. The API then checks what actually arrived.
    const { id, upload } = await apiFetch<{ id: string | null; upload: DirectUploadTicket | null }>(user, "/media/direct", {
      method: "POST",
      json: { purpose, mimetype: file.type, size: file.size },
    });
    if (id && upload) {
      await sendToStorage(upload, file, onProgress);
      return apiFetch<UploadedMedia>(user, `/media/${id}/complete`, { method: "POST", signal: AbortSignal.timeout(60_000) });
    }
    // Provider without direct uploads: fall through to the API route.
  }
  const body = new FormData();
  body.append("purpose", purpose);
  body.append("file", file);
  // A 100 MB video on slow mobile data can take many minutes; photos are quick.
  const timeoutMs = video ? DIRECT_UPLOAD_TIMEOUT_MS : 120_000;
  if (onProgress) return apiUpload<UploadedMedia>(user, "/media", body, { onProgress, timeoutMs });
  return apiFetch<UploadedMedia>(user, "/media", { method: "POST", body, signal: AbortSignal.timeout(timeoutMs) });
}

/**
 * live: POST /media/import { url, purpose } → same shape as an upload. The
 * API downloads the linked photo/video and stores it, so it keeps working
 * if the other site changes, and the same limits apply (contract §20).
 */
export async function importMedia(user: User, url: string, purpose: MediaPurpose): Promise<UploadedMedia> {
  const link = resolveImageUrl(url);
  if (!isLive("media")) {
    return { id: `mock-${crypto.randomUUID()}`, url: link, resourceType: /\.(mp4|mov|webm|m4v)(?:[?#]|$)/i.test(link) ? "video" : "image" };
  }
  return apiFetch<UploadedMedia>(user, "/media/import", { method: "POST", json: { url: link, purpose }, signal: AbortSignal.timeout(90_000) });
}

/** POST the file to the storage provider as the ticket says (no API token: the signature is the permission). */
function sendToStorage(ticket: DirectUploadTicket, file: File, onProgress?: (fraction: number) => void): Promise<void> {
  const form = new FormData();
  for (const [k, v] of Object.entries(ticket.fields)) form.append(k, v);
  form.append(ticket.fileField, file);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", ticket.url);
    xhr.timeout = DIRECT_UPLOAD_TIMEOUT_MS;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    const fail = (kind: "network" | "timeout" | "client") =>
      reject(
        new ApiError(
          kind === "client" ? "The video didn't upload. It may be damaged or in a format we can't read." : "The upload didn't finish. Check your connection and try again.",
          kind === "client" ? 400 : 0,
          kind,
        ),
      );
    xhr.onerror = () => fail("network");
    xhr.ontimeout = () => fail("timeout");
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : fail(xhr.status >= 500 ? "network" : "client"));
    xhr.send(form);
  });
}

/** live: DELETE /media/:id. Best effort: a leftover file is harmless, so failures are ignored. */
export function discardMedia(user: User, id: string): void {
  if (!isLive("media") || id.startsWith("mock-")) return;
  void apiFetch<void>(user, `/media/${id}`, { method: "DELETE" }).catch(() => undefined);
}

/** Validates a pasted link before importing it. */
export function resolveImageUrl(input: string): string {
  const trimmed = input.trim();
  if (!/^https:\/\/.+/i.test(trimmed)) {
    throw new Error("Enter a link starting with https://");
  }
  return trimmed;
}
