import { errorMessage } from "@myhoodora/api-contract/errors";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { deleteMedia, preparePhoto, uploadPhoto, type MediaPurpose, type PickedPhoto } from "./media";

export interface PhotoItem {
  key: string;
  /** The local file, shown at once. */
  uri: string;
  status: "uploading" | "done" | "failed";
  url?: string;
  id?: string;
  error?: string;
}

let nextKey = 0;

/**
 * Photos for a draft: each uploads as soon as it's chosen (so posting is quick), shows its own state,
 * and can be retried or removed. Removing an uploaded one deletes it from storage. Progress is counted
 * in photos, which is real; there's no made-up percentage.
 */
export function usePhotoUploads(purpose: MediaPurpose, max: number) {
  const user = useSignedInUser();
  const [items, setItems] = useState<PhotoItem[]>([]);
  const sources = useRef(new Map<string, PickedPhoto>());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const patch = useCallback((key: string, change: Partial<PhotoItem>) => {
    if (alive.current) setItems((list) => list.map((p) => (p.key === key ? { ...p, ...change } : p)));
  }, []);

  const upload = useCallback(
    async (key: string) => {
      const source = sources.current.get(key);
      if (!source) return;
      patch(key, { status: "uploading", error: undefined });
      try {
        const prepared = await preparePhoto(source);
        const media = await uploadPhoto(user, prepared, purpose);
        // Removed while it was uploading: don't leave it in storage.
        if (!sources.current.has(key)) return void deleteMedia(user, media.id);
        patch(key, { status: "done", url: media.url, id: media.id });
      } catch (err) {
        patch(key, { status: "failed", error: errorMessage(err) });
      }
    },
    [user, purpose, patch],
  );

  const add = useCallback(
    (photos: PickedPhoto[]) => {
      const room = Math.max(0, max - sources.current.size);
      const added = photos.slice(0, room).map((photo) => {
        nextKey += 1;
        const key = `photo-${nextKey}`;
        sources.current.set(key, photo);
        return { key, uri: photo.uri, status: "uploading" as const };
      });
      setItems((list) => [...list, ...added]);
      // Two at a time: quicker than one, without choking a slow connection.
      const queue = added.map((a) => a.key);
      const worker = async () => {
        for (let key = queue.shift(); key; key = queue.shift()) await upload(key);
      };
      void Promise.all([worker(), worker()]);
      return photos.length - added.length;
    },
    [max, upload],
  );

  const remove = useCallback(
    (key: string) => {
      const item = items.find((p) => p.key === key);
      sources.current.delete(key);
      setItems((list) => list.filter((p) => p.key !== key));
      if (item?.id) void deleteMedia(user, item.id);
    },
    [items, user],
  );

  /** Sent: start an empty draft. The files stay, since what was sent now uses them. */
  const clear = useCallback(() => {
    sources.current.clear();
    setItems([]);
  }, []);

  const done = items.filter((p) => p.status === "done");
  return {
    items,
    add,
    remove,
    clear,
    retry: (key: string) => void upload(key),
    urls: done.map((p) => p.url!),
    uploading: items.filter((p) => p.status === "uploading").length,
    failed: items.filter((p) => p.status === "failed").length,
    room: max - items.length,
  };
}

export type PhotoUploads = ReturnType<typeof usePhotoUploads>;
