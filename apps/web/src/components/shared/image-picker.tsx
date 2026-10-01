"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Film, ImagePlus, Link2, Loader2, Play, Video, X } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import { useAuth } from "@/context/AuthContext";
import {
  MEDIA_ACCEPT,
  PHOTO_ACCEPT,
  checkMedia,
  checkPhoto,
  discardMedia,
  importMedia,
  isVideoFile,
  resolveImageUrl,
  uploadMedia,
  videoDuration,
  type MediaPurpose,
} from "@/lib/api/media";
import { errorMessage } from "@/lib/api/client";
import { isVideoUrl } from "@/lib/media/media-url";
import { fieldInputClass } from "./field";

/** A picked item: uploaded (has an id we can delete), pasted (URL only) or still uploading. */
interface PickedMedia {
  key: string;
  kind: "image" | "video";
  url?: string;
  preview: string;
  mediaId?: string;
  uploading: boolean;
  seconds?: number;
}

interface PhotoPickerProps {
  value: string[];
  onChange: (urls: string[]) => void;
  purpose: MediaPurpose;
  /** Nextdoor caps posts at 10 photos. */
  max?: number;
  /** Posts: photos *or* one short video (≤ 60 s, ≤ 50 MB). */
  allowVideo?: boolean;
  disabled?: boolean;
  /** Parent can block submit while files are still uploading. */
  onUploadingChange?: (uploading: boolean) => void;
}

const fromUrl = (url: string): PickedMedia => ({ key: url, kind: isVideoUrl(url) ? "video" : "image", url, preview: url, uploading: false });
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/**
 * Add photos (or one video) to a post, listing or group: upload through the
 * API (contract §20) or paste a photo URL. Thumbnails appear instantly from a
 * local preview; each file uploads in parallel with its progress shown, and
 * can be removed (removing an upload deletes it).
 */
export function PhotoPicker({ value, onChange, purpose, max = 10, allowVideo = false, disabled, onUploadingChange }: PhotoPickerProps) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const recordRef = useRef<HTMLInputElement>(null);
  // Phones/tablets can open the camera straight from the picker; desktops ignore `capture`, so hide it there.
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(window.matchMedia("(pointer: coarse)").matches), []);
  const [items, setItems] = useState<PickedMedia[]>(() => value.map(fromUrl));
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [urlMode, setUrlMode] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  // Latest list for async callbacks (uploads finish in any order).
  const latest = useRef(items);

  // The parent cleared or replaced the value (e.g. form reset): follow it.
  const valueKey = value.join("\n");
  useEffect(() => {
    const current = latest.current;
    if (current.some((p) => p.uploading)) return;
    if (current.map((p) => p.url).join("\n") === valueKey) return;
    const next = value.map(fromUrl);
    latest.current = next;
    setItems(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- valueKey is the content of value
  }, [valueKey]);

  // Release local video previews when the picker goes away.
  useEffect(() => () => latest.current.forEach((p) => p.preview.startsWith("blob:") && URL.revokeObjectURL(p.preview)), []);

  const commit = (next: PickedMedia[]) => {
    latest.current = next;
    setItems(next);
    onChange(next.filter((p) => p.url && !p.uploading).map((p) => p.url!));
    onUploadingChange?.(next.some((p) => p.uploading));
  };

  const hasVideo = items.some((p) => p.kind === "video");
  const full = hasVideo || items.length >= max;

  const addFiles = async (files: File[]) => {
    if (!user || !files.length) return;
    const videos = files.filter(isVideoFile);
    if (videos.length && (!allowVideo || videos.length > 1 || files.length > 1 || latest.current.length > 0)) {
      toast.error(allowVideo ? "Add photos or one video, not both." : "Only photos can be added here.");
      return;
    }
    const room = max - latest.current.length;
    if (files.length > room) toast.error(room > 0 ? `You can add ${room} more photo${room === 1 ? "" : "s"}.` : `Up to ${max} photos.`);

    const accepted: { file: File; item: PickedMedia }[] = [];
    for (const file of files.slice(0, Math.max(room, 0))) {
      const problem = allowVideo ? await checkMedia(file) : checkPhoto(file);
      if (problem) {
        toast.error(files.length > 1 ? `${file.name}: ${problem}` : problem);
        continue;
      }
      const video = isVideoFile(file);
      accepted.push({
        file,
        item: {
          key: crypto.randomUUID(),
          kind: video ? "video" : "image",
          preview: URL.createObjectURL(file),
          uploading: true,
          seconds: video ? ((await videoDuration(file)) ?? undefined) : undefined,
        },
      });
    }
    if (!accepted.length) return;
    commit([...latest.current, ...accepted.map((a) => a.item)]);

    for (const { file, item } of accepted) {
      uploadMedia(user, file, purpose, (f) => setProgress((p) => ({ ...p, [item.key]: f })))
        .then((media) => {
          // Removed while uploading: throw the upload away.
          if (!latest.current.some((p) => p.key === item.key)) return discardMedia(user, media.id);
          // Photos switch to the stored copy (and free the local preview); videos keep the local
          // preview while the provider prepares the delivery file.
          const preview = item.kind === "image" ? media.url : item.preview;
          if (item.kind === "image") URL.revokeObjectURL(item.preview);
          commit(latest.current.map((p) => (p.key === item.key ? { ...p, url: media.url, preview, mediaId: media.id, uploading: false } : p)));
        })
        .catch((err) => {
          toast.error(errorMessage(err, item.kind === "video" ? "That video didn't upload. Try again." : "That photo didn't upload. Try again."));
          URL.revokeObjectURL(item.preview);
          commit(latest.current.filter((p) => p.key !== item.key));
        })
        .finally(() =>
          setProgress((p) => {
            const rest = { ...p };
            delete rest[item.key];
            return rest;
          }),
        );
    }
  };

  const pickFrom = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    void addFiles(files);
  };

  const remove = (item: PickedMedia) => {
    if (user && item.mediaId) discardMedia(user, item.mediaId);
    if (item.preview.startsWith("blob:")) URL.revokeObjectURL(item.preview);
    commit(latest.current.filter((p) => p.key !== item.key));
  };

  /** "Add from link": the API downloads and stores the file, so it's checked and kept like an upload. */
  const confirmUrl = () => {
    if (!user) return;
    let link: string;
    try {
      link = resolveImageUrl(urlInput);
    } catch (err) {
      return toast.error(errorMessage(err, "Enter a valid link."));
    }
    if (full) return toast.error(`Up to ${max} photos.`);
    const item: PickedMedia = { key: crypto.randomUUID(), kind: "image", preview: "", uploading: true };
    commit([...latest.current, item]);
    setUrlMode(false);
    setUrlInput("");
    importMedia(user, link, purpose)
      .then((media) => {
        const others = latest.current.filter((p) => p.key !== item.key);
        const gone = others.length === latest.current.length;
        const mixes = media.resourceType === "video" && (!allowVideo || others.length > 0);
        if (gone || mixes) {
          discardMedia(user, media.id);
          if (mixes) toast.error(allowVideo ? "Add photos or one video, not both." : "Only photos can be added here.");
          return commit(others);
        }
        commit(latest.current.map((p) => (p.key === item.key ? { ...p, kind: media.resourceType, url: media.url, preview: media.url, mediaId: media.id, uploading: false } : p)));
      })
      .catch((err) => {
        toast.error(errorMessage(err, "We couldn't add that link. Upload the file instead."));
        commit(latest.current.filter((p) => p.key !== item.key));
      });
  };

  return (
    <div className="space-y-2">
      {/* Take a photo / record a clip now, for when it isn't on the device yet. */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pickFrom(e)} />
      {allowVideo && <input ref={recordRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => pickFrom(e)} />}
      <input
        ref={fileRef}
        type="file"
        accept={allowVideo ? MEDIA_ACCEPT : PHOTO_ACCEPT}
        multiple={max > 1}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void addFiles(files);
        }}
      />
      {items.length > 0 && (
        <ul className={cn("grid gap-2", max === 1 || hasVideo ? "grid-cols-1" : "grid-cols-3 sm:grid-cols-4")}>
          {items.map((p) => {
            const pct = Math.round((progress[p.key] ?? 0) * 100);
            return (
              <li
                key={p.key}
                className={cn(
                  "relative overflow-hidden rounded-xl border border-border bg-muted",
                  p.kind === "video" ? "aspect-video w-full max-w-sm bg-black" : max === 1 ? "aspect-[4/3] w-full max-w-xs" : "aspect-square",
                )}
              >
                {p.kind === "video" ? (
                  <>
                    <video src={p.preview} muted playsInline preload="metadata" className={cn("size-full object-contain", p.uploading && "opacity-60")} />
                    <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-xs font-semibold text-white">
                      <Play className="size-3 fill-current" aria-hidden />
                      {p.seconds ? clock(p.seconds) : "Video"}
                    </span>
                  </>
                ) : p.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local blob previews and stored uploads
                  <img src={p.preview} alt="" className={cn("size-full object-cover", p.uploading && "opacity-60")} />
                ) : (
                  <span className="flex size-full flex-col items-center justify-center gap-1 text-xs font-semibold text-muted-foreground">
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                    Adding from link…
                  </span>
                )}
                {p.uploading && p.preview && (
                  <span className="absolute inset-0 flex items-center justify-center" role="status" aria-label={`Uploading, ${pct}%`}>
                    <span className="relative flex size-12 items-center justify-center rounded-full bg-black/55 text-xs font-bold text-white">
                      <svg viewBox="0 0 36 36" className="absolute inset-0 size-full -rotate-90" aria-hidden>
                        <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                        <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${Math.max(pct, 2) * 0.974} 97.4`} />
                      </svg>
                      {pct}%
                    </span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(p)}
                  disabled={disabled}
                  aria-label={p.kind === "video" ? "Remove video" : "Remove photo"}
                  className="absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-full bg-foreground/70 text-background hover:bg-foreground/85"
                >
                  <X className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {!full && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={disabled} onClick={() => fileRef.current?.click()}>
            {allowVideo && !items.length ? <Film className="size-4" /> : <ImagePlus className="size-4" />}
            {items.length ? "Add more" : allowVideo ? "Photo/video" : max > 1 ? "Add photos" : "Add photo"}
          </Button>
          {touch && (
            <Button variant="outline" size="sm" disabled={disabled} onClick={() => cameraRef.current?.click()}>
              <Camera className="size-4" />
              Camera
            </Button>
          )}
          {touch && allowVideo && !items.length && (
            <Button variant="outline" size="sm" disabled={disabled} onClick={() => recordRef.current?.click()}>
              <Video className="size-4" />
              Record video
            </Button>
          )}
          <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setUrlMode((m) => !m)}>
            <Link2 className="size-4" />
            Add from link
          </Button>
          {max > 1 && items.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {items.length}/{max}
            </span>
          )}
        </div>
      )}
      {allowVideo && !items.length && <p className="text-xs text-muted-foreground">Up to {max} photos, or one video up to 60 seconds and 100 MB.</p>}
      {urlMode && !full && (
        <div className="flex gap-2">
          <input
            aria-label={allowVideo ? "Link to a photo or video" : "Link to a photo"}
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmUrl();
              }
            }}
            placeholder={allowVideo ? "https://… link to a photo or video file" : "https://… link to a photo"}
            className={fieldInputClass}
          />
          <Button size="sm" onClick={confirmUrl}>
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

interface ImagePickerProps {
  value: string | null;
  onChange: (url: string | null) => void;
  purpose: MediaPurpose;
  disabled?: boolean;
}

/** One photo (e.g. group cover): the same picker, capped at one. */
export function ImagePicker({ value, onChange, purpose, disabled }: ImagePickerProps) {
  return <PhotoPicker value={value ? [value] : []} onChange={(urls) => onChange(urls[0] ?? null)} purpose={purpose} max={1} disabled={disabled} />;
}
