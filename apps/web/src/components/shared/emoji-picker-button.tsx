"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { SmilePlus } from "lucide-react";
import { EmojiStyle, Theme, type EmojiClickData } from "emoji-picker-react";
import { cn } from "@myhoodora/ui/utils";

// The picker ships the full emoji dataset, so keep it out of the feed's initial bundle.
const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-[380px] w-full items-center justify-center text-sm text-muted-foreground"
      role="status"
    >
      Loading emoji…
    </div>
  ),
});

interface EmojiPickerButtonProps {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
  className?: string;
}

export function EmojiPickerButton({
  onSelect,
  disabled,
  className,
}: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleEmojiClick = (data: EmojiClickData) => {
    onSelect(data.emoji);
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-label="Add emoji"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex size-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary disabled:pointer-events-none disabled:opacity-50",
          open && "bg-primary/10 text-primary",
        )}
      >
        <SmilePlus className="size-5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose an emoji"
          className="absolute top-full left-0 z-30 mt-2 w-[min(22rem,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg"
        >
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            width="100%"
            height={380}
            theme={Theme.LIGHT}
            emojiStyle={EmojiStyle.NATIVE}
            lazyLoadEmojis
            previewConfig={{ showPreview: false }}
            searchPlaceHolder="Search emoji"
          />
        </div>
      )}
    </div>
  );
}
