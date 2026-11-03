"use client";

import { useCallback, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { errorMessage } from "@/lib/api/client";
import { deleteMedia, isPdfFile, uploadMedia, type MediaPurpose } from "@/lib/api/media";

export interface Attachment {
  key: string;
  kind: "image" | "document";
  name: string;
  /** A local preview (photos), shown while it uploads. */
  preview?: string;
  status: "uploading" | "done" | "failed";
  url?: string;
  id?: string;
  error?: string;
}

let seq = 0;

/**
 * Files for a message (photos, and PDFs in support): each uploads as soon as it's chosen, shows its
 * state, and can be retried or removed; removing an uploaded one deletes it from storage. The same
 * idea as the app's usePhotoUploads.
 */
export function useAttachments(user: User | null, purpose: MediaPurpose, max: number) {
  const [items, setItems] = useState<Attachment[]>([]);
  const files = useRef(new Map<string, File>());

  const patch = (key: string, change: Partial<Attachment>) => setItems((list) => list.map((a) => (a.key === key ? { ...a, ...change } : a)));

  const upload = useCallback(
    async (key: string) => {
      const file = files.current.get(key);
      if (!file || !user) return;
      patch(key, { status: "uploading", error: undefined });
      try {
        const media = await uploadMedia(user, file, purpose);
        if (!files.current.has(key)) return void deleteMedia(user, media.id).catch(() => undefined);
        patch(key, { status: "done", url: media.url, id: media.id });
      } catch (err) {
        patch(key, { status: "failed", error: errorMessage(err) });
      }
    },
    [user, purpose],
  );

  /** Returns how many didn't fit. */
  const add = (picked: File[]): number => {
    const room = Math.max(0, max - files.current.size);
    const added = picked.slice(0, room).map((file): Attachment => {
      seq += 1;
      const key = `att-${seq}`;
      files.current.set(key, file);
      const pdf = isPdfFile(file);
      return { key, kind: pdf ? "document" : "image", name: file.name, preview: pdf ? undefined : URL.createObjectURL(file), status: "uploading" };
    });
    setItems((list) => [...list, ...added]);
    for (const a of added) void upload(a.key);
    return picked.length - added.length;
  };

  const remove = (key: string) => {
    const item = items.find((a) => a.key === key);
    files.current.delete(key);
    setItems((list) => list.filter((a) => a.key !== key));
    if (item?.preview) URL.revokeObjectURL(item.preview);
    if (item?.id && user) void deleteMedia(user, item.id).catch(() => undefined);
  };

  /** Sent: an empty draft. The files stay stored, since the message now uses them. */
  const clear = () => {
    files.current.clear();
    setItems([]);
  };

  const done = items.filter((a) => a.status === "done");
  return {
    items,
    add,
    remove,
    clear,
    retry: (key: string) => void upload(key),
    ready: done.map((a) => ({ url: a.url!, kind: a.kind, name: a.name })),
    uploading: items.some((a) => a.status === "uploading"),
    failed: items.some((a) => a.status === "failed"),
    room: max - items.length,
  };
}

export type Attachments = ReturnType<typeof useAttachments>;
