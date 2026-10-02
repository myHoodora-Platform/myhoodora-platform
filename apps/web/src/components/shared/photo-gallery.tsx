"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@myhoodora/ui/dialog";
import { cn } from "@myhoodora/ui/utils";
import { clampAspect, imageSrcSet, imageUrl, isCloudinaryUrl, isVideoUrl, videoPoster } from "@/lib/media/media-url";
import { ImageWithFallback } from "./image-with-fallback";

/** Feed column is ~560 px wide on desktop and full width on phones. */
const FEED_SIZES = "(min-width: 768px) 560px, 100vw";
/** The multi-photo grid is 4:3; tiles take their shape from the layout. */
const GRID_ASPECT = 4 / 3;

/**
 * On a phone a 4:5 frame is about half the screen. In the wide desktop column
 * it would be taller than the window, so single photos and videos are capped
 * there, as Facebook, Instagram and Nextdoor do on the web. Nothing is cropped
 * to fit: the media sits centred, whole, with its sides filled in. 640px is
 * the column's own width, so square and landscape media are never affected.
 */
const FRAME_CAP = "max-h-[640px]";

// Shapes learned from media that has loaded, for URLs the API sent no shape
// for (pasted links, older clients). A card that re-mounts (back navigation,
// a refreshed feed) is then framed correctly from its first paint.
const learnedAspects = new Map<string, number>();
const knownAspect = (url: string, hint?: number | null) => hint ?? learnedAspects.get(url);

/**
 * A post's media, framed like Instagram/Facebook/Nextdoor:
 * - one photo at its own shape, kept between 4:5 portrait and 1.91:1 landscape
 *   (anything taller or wider is smart-cropped around faces/subjects);
 * - 2–4+ photos as a 4:3 grid (1 large + 2 for three; "+N" beyond four);
 * - a video as an inline player (poster frame, tap to play, no autoplay).
 * Tapping a photo opens a full-screen viewer.
 *
 * `aspects` (width ÷ height per URL, from the API) sizes the frame before the
 * media arrives, so the post doesn't start small and grow as it loads.
 */
export function PhotoGallery({ urls, aspects, className }: { urls: string[]; aspects?: (number | null)[]; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!urls.length) return null;

  const videoIndex = urls.findIndex(isVideoUrl);
  if (videoIndex >= 0) return <VideoPlayer url={urls[videoIndex]!} aspectHint={aspects?.[videoIndex]} className={className} />;

  const shown = urls.slice(0, 4);
  const extra = urls.length - shown.length;

  return (
    <>
      {urls.length === 1 ? (
        <button type="button" onClick={() => setOpen(0)} aria-label="View photo" className={cn("block w-full bg-muted", className)}>
          <SinglePhoto url={urls[0]!} aspectHint={aspects?.[0]} />
        </button>
      ) : (
        <div className={cn("grid gap-0.5", urls.length === 2 ? "grid-cols-2" : "grid-cols-2 grid-rows-2", className)} style={{ aspectRatio: GRID_ASPECT }}>
          {shown.map((url, i) => {
            const aspect = tileAspect(urls.length, i);
            return (
              <button
                key={`${url}-${i}`}
                type="button"
                onClick={() => setOpen(i)}
                aria-label={`View photo ${i + 1} of ${urls.length}`}
                className={cn("relative overflow-hidden bg-muted", urls.length === 3 && i === 0 && "row-span-2")}
              >
                <ImageWithFallback
                  src={imageUrl(url, { width: 540, aspect })}
                  srcSet={imageSrcSet(url, { aspect }, [270, 360, 540, 720])}
                  sizes="(min-width: 768px) 280px, 50vw"
                  alt=""
                  wrapperClassName="absolute inset-0"
                  className="size-full object-cover"
                  style={{ objectPosition: "50% 30%" }}
                />
                {extra > 0 && i === shown.length - 1 && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-2xl font-bold text-white">+{extra}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
      <PhotoViewer urls={urls} index={open} onIndex={setOpen} />
    </>
  );
}

/** Tile shape inside the 4:3 grid: halves are 2:3, quarters are 4:3. */
function tileAspect(count: number, i: number): number {
  const half = GRID_ASPECT / 2;
  if (count === 2) return half;
  if (count === 3) return i === 0 ? half : GRID_ASPECT;
  return GRID_ASPECT;
}

/**
 * One photo at its natural shape within the feed range: in range → shown
 * whole; out of range → the frame is clamped and (for Cloudinary) a
 * smart-cropped copy replaces the centre crop. With a known shape all of that
 * is decided up front; without one we only learn it once the photo loads.
 */
function SinglePhoto({ url, aspectHint }: { url: string; aspectHint?: number | null }) {
  const natural = knownAspect(url, aspectHint);
  const needsCrop = natural !== undefined && Math.abs(natural - clampAspect(natural)) > 0.02 && isCloudinaryUrl(url);
  const [aspect, setAspect] = useState<number | null>(natural !== undefined ? clampAspect(natural) : null);
  const [cropTo, setCropTo] = useState<number | undefined>(needsCrop ? clampAspect(natural) : undefined);

  return (
    <div className={cn("relative w-full overflow-hidden", FRAME_CAP)} style={{ aspectRatio: aspect ?? 1 }}>
      {/* Where the capped frame is wider than the photo, a soft blur of the photo itself fills the sides. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl(url, { width: 64, aspect: cropTo })} alt="" aria-hidden className="absolute inset-0 size-full scale-125 object-cover opacity-70 blur-2xl" />
      <ImageWithFallback
        src={imageUrl(url, { width: 1080, aspect: cropTo })}
        srcSet={imageSrcSet(url, { aspect: cropTo })}
        sizes={FEED_SIZES}
        alt=""
        wrapperClassName="absolute inset-0"
        className="size-full object-contain"
        onLoaded={(img) => {
          if (cropTo || !img.naturalWidth) return;
          const loaded = img.naturalWidth / img.naturalHeight;
          const clamped = clampAspect(loaded);
          learnedAspects.set(url, loaded);
          setAspect(clamped);
          if (Math.abs(loaded - clamped) > 0.02 && isCloudinaryUrl(url)) setCropTo(clamped);
        }}
      />
    </div>
  );
}

/** Inline video: poster frame, native controls, plays in place on iOS, never autoplays with sound. */
function VideoPlayer({ url, aspectHint, className }: { url: string; aspectHint?: number | null; className?: string }) {
  // Framed from what we already know about the clip; 16:9 only as a last resort.
  const [aspect, setAspect] = useState(() => clampAspect(knownAspect(url, aspectHint) ?? 16 / 9));
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const poster = videoPoster(url);

  // Like Facebook/Instagram: scrolling a playing video out of view pauses it.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => entry && entry.intersectionRatio < 0.25 && !el.paused && el.pause(), { threshold: [0, 0.25] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className={cn("relative w-full bg-black", FRAME_CAP, className)} style={{ aspectRatio: aspect }}>
      <video
        ref={ref}
        src={poster ? url : `${url}#t=0.1`}
        poster={poster}
        controls={started}
        playsInline
        preload="metadata"
        className="absolute inset-0 size-full object-contain"
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (!v.videoWidth || !v.videoHeight) return;
          learnedAspects.set(url, v.videoWidth / v.videoHeight);
          setAspect(clampAspect(v.videoWidth / v.videoHeight));
        }}
        onPlay={() => setStarted(true)}
      >
        <track kind="captions" />
      </video>
      {!started && (
        <button
          type="button"
          aria-label="Play video"
          onClick={() => {
            setStarted(true);
            void ref.current?.play();
          }}
          className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors hover:bg-black/20"
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur">
            <Play className="ml-1 size-7 fill-current" />
          </span>
        </button>
      )}
    </div>
  );
}

function PhotoViewer({ urls, index, onIndex }: { urls: string[]; index: number | null; onIndex: (i: number | null) => void }) {
  const many = urls.length > 1;
  const go = (d: number) => index !== null && onIndex((index + d + urls.length) % urls.length);

  useEffect(() => {
    if (index === null || !many) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <Dialog open={index !== null} onOpenChange={(o) => !o && onIndex(null)}>
      <DialogContent className="max-w-4xl gap-0 border-none bg-black p-0 text-white sm:rounded-2xl">
        <DialogTitle className="sr-only">{many && index !== null ? `Photo ${index + 1} of ${urls.length}` : "Photo"}</DialogTitle>
        {index !== null && (
          <div className="relative flex min-h-[50vh] items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- user photos from any https host */}
            <img
              src={imageUrl(urls[index]!, { width: 1600 })}
              srcSet={imageSrcSet(urls[index]!, {}, [720, 1080, 1600, 2400])}
              sizes="(min-width: 896px) 896px, 100vw"
              alt=""
              className="max-h-[85dvh] w-auto max-w-full object-contain"
            />
            {many && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-2 flex size-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25">
                  <ChevronLeft className="size-5" />
                </button>
                <button type="button" onClick={() => go(1)} aria-label="Next photo" className="absolute right-2 flex size-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25">
                  <ChevronRight className="size-5" />
                </button>
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold">
                  {index + 1} / {urls.length}
                </span>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
