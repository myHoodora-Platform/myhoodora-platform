"use client";

import { useIsDark } from "./theme-sync";
import { useState } from "react";
import dynamic from "next/dynamic";
import { SmilePlus } from "lucide-react";
import { EmojiStyle, SuggestionMode, Theme, type EmojiClickData } from "emoji-picker-react";
import { Popover, PopoverContent, PopoverTrigger } from "@myhoodora/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@myhoodora/ui/sheet";
import { cn } from "@myhoodora/ui/utils";
import { useIsMobile } from "@/hooks/use-media-query";

// The picker ships the full emoji dataset, so it's only fetched on first open.
const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-72 w-full items-center justify-center text-sm text-muted-foreground" role="status">
      Loading emoji…
    </div>
  ),
});

/** Most-used in Nigerian neighbourhood chats — one tap, no picker needed. */
const QUICK = ["🙏", "👍", "❤️", "😂", "🙌", "🎉", "😢", "🔥"];

interface EmojiPickerButtonProps {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Emoji button for any text box. Desktop: a popover that positions itself
 * to stay fully on screen (flips above/below, never needs scrolling).
 * Phones: a bottom sheet, like WhatsApp/Facebook. Stays open so several
 * emoji can be added; a quick row covers the common ones.
 */
export function EmojiPickerButton({ onSelect, disabled, className }: EmojiPickerButtonProps) {
  const isMobile = useIsMobile();
  const dark = useIsDark();
  const [open, setOpen] = useState(false);

  const trigger = (
    <button
      type="button"
      aria-label="Add emoji"
      disabled={disabled}
      onClick={isMobile ? () => setOpen(true) : undefined}
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-primary disabled:pointer-events-none disabled:opacity-50",
        open && "bg-primary/10 text-primary",
        className,
      )}
    >
      <SmilePlus className="size-5" aria-hidden />
    </button>
  );

  const body = (height: number | string) => (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between gap-1 px-1" role="group" aria-label="Quick emoji">
        {QUICK.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onSelect(e)}
            aria-label={`Insert ${e}`}
            className="flex size-10 items-center justify-center rounded-full text-2xl transition-transform hover:scale-110 hover:bg-muted"
          >
            {e}
          </button>
        ))}
      </div>
      <div style={{ height }} className="overflow-hidden rounded-xl">
        <EmojiPicker
          onEmojiClick={(data: EmojiClickData) => onSelect(data.emoji)}
          width="100%"
          height="100%"
          theme={dark ? Theme.DARK : Theme.LIGHT}
          emojiStyle={EmojiStyle.NATIVE}
          suggestedEmojisMode={SuggestionMode.RECENT}
          lazyLoadEmojis
          skinTonesDisabled={false}
          previewConfig={{ showPreview: false }}
          searchPlaceHolder="Search emoji"
        />
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="gap-3 p-3 pt-4">
            <SheetTitle className="px-1 text-base">Add emoji</SheetTitle>
            <SheetDescription className="sr-only">Tap emoji to add them. Close when you&apos;re done.</SheetDescription>
            {body("min(52dvh, 26rem)")}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        collisionPadding={12}
        className="w-[22rem] p-2"
        // Keep focus in the text box so the caret position is preserved.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {body("min(22rem, calc(var(--radix-popover-content-available-height) - 4rem))")}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Insert text at the caret of a textarea/input (replacing any selection) and
 * put the caret after it. Returns the new value for controlled inputs.
 */
export function insertAtCaret(el: HTMLTextAreaElement | HTMLInputElement | null, current: string, text: string): string {
  const start = el?.selectionStart ?? current.length;
  const end = el?.selectionEnd ?? current.length;
  const next = current.slice(0, start) + text + current.slice(end);
  const caret = start + text.length;
  requestAnimationFrame(() => {
    if (!el) return;
    el.focus();
    el.setSelectionRange(caret, caret);
  });
  return next;
}
