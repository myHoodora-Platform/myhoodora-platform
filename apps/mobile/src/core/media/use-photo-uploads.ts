import { errorMessage } from "@myhoodora/api-contract/errors";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { deleteMedia, preparePhoto, uploadDocument, uploadPhoto, uploadWithRetry, type MediaPurpose, type PickedDocument, type PickedPhoto } from "./media";

export interface PhotoItem {
  key: string;
  /** A photo, or (support conversations) a PDF. */
  kind: "image" | "document";
  /** The local file, shown at once. */
  uri: string;
  /** A document's file name. */
  name?: string;
  size?: number;
  status: "uploading" | "done" | "failed";
  url?: string;
  id?: string;
  error?: string;
}

let nextKey = 0;

/**
 * Photos (and, in support conversations, PDFs) for a draft: each uploads as soon as it's chosen (so posting is quick), shows its own state,
 * and can be retried or removed. Removing an uploaded one deletes it from storage. Progress is counted
 * in photos, which is real; there's no made-up percentage.
 */
export function usePhotoUploads(purpose: MediaPurpose, max: number) {
  const user = useSignedInUser();
  const [items, setItems] = useState<PhotoItem[]>([]);
  const sources = useRef(new Map<string, { photo: PickedPhoto } | { document: PickedDocument }>());
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
        // Shrunk once; a quiet second try (after a blip) sends the same file.
        const prepared = "photo" in source ? await preparePhoto(source.photo) : null;
        const media = await uploadWithRetry(() => ("photo" in source ? uploadPhoto(user, prepared!, purpose) : uploadDocument(user, source.document, purpose)));
        // Removed while it was uploading: don't leave it in storage.
        if (!sources.current.has(key)) return void deleteMedia(user, media.id);
        patch(key, { status: "done", url: media.url, id: media.id });
      } catch (err) {
        // In the developer log too: an upload that fails on one phone is otherwise hard to explain.
        console.warn(`Upload (${purpose}) failed:`, err);
        patch(key, { status: "failed", error: errorMessage(err) });
      }
    },
    [user, purpose, patch],
  );

  const enqueue = useCallback(
    (picked: ({ photo: PickedPhoto } | { document: PickedDocument })[]) => {
      const room = Math.max(0, max - sources.current.size);
      const added = picked.slice(0, room).map((p): PhotoItem => {
        nextKey += 1;
        const key = `file-${nextKey}`;
        sources.current.set(key, p);
        return "photo" in p
          ? { key, kind: "image", uri: p.photo.uri, status: "uploading" }
          : { key, kind: "document", uri: p.document.uri, name: p.document.name, size: p.document.size, status: "uploading" };
      });
      setItems((list) => [...list, ...added]);
      // Two at a time: quicker than one, without choking a slow connection.
      const queue = added.map((a) => a.key);
      const worker = async () => {
        for (let key = queue.shift(); key; key = queue.shift()) await upload(key);
      };
      void Promise.all([worker(), worker()]);
      return picked.length - added.length;
    },
    [max, upload],
  );
  /** Returns how many didn't fit. */
  const add = useCallback((photos: PickedPhoto[]) => enqueue(photos.map((photo) => ({ photo }))), [enqueue]);
  const addDocuments = useCallback((documents: PickedDocument[]) => enqueue(documents.map((document) => ({ document }))), [enqueue]);

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
    addDocuments,
    remove,
    clear,
    retry: (key: string) => void upload(key),
    urls: done.map((p) => p.url!),
    /** What's ready to send, photos and documents, with a document's name. */
    attachments: done.map((p) => ({ url: p.url!, kind: p.kind, ...(p.name && { name: p.name }) })),
    uploading: items.filter((p) => p.status === "uploading").length,
    failed: items.filter((p) => p.status === "failed").length,
    room: max - items.length,
  };
}

export type PhotoUploads = ReturnType<typeof usePhotoUploads>;
