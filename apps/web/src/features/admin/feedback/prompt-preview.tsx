"use client";

import { useState } from "react";
import type { AdminPromptInput, PromptAccent } from "@myhoodora/api-contract/prompts";
import { Star, X } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";

/** The app's accent pairs (apps/mobile/src/shared/theme/accents.ts), light mode. */
const ACCENT: Record<PromptAccent, { bg: string; fg: string }> = {
  green: { bg: "#E7F4EE", fg: "#0F5132" },
  blue: { bg: "#E8F0FE", fg: "#1E3A8A" },
  amber: { bg: "#FEF3C7", fg: "#92400E" },
  rose: { bg: "#FFE4E6", fg: "#9F1239" },
  slate: { bg: "#F1F5F9", fg: "#334155" },
};
const STAR_WORDS = ["Very poor", "Poor", "Okay", "Good", "Excellent"];
const npsTone = (n: number) => (n <= 6 ? "#DC2626" : n <= 8 ? "#D97706" : "#16A34A");

/**
 * How the prompt looks on a phone, in its layout (a sheet, a centred card, or a card at the top of
 * the feed). Try it: tapping works as it will in the app (nothing is sent).
 */
export function PromptPreview({ prompt }: { prompt: AdminPromptInput }) {
  const layout = prompt.layout ?? "sheet";
  const body = <PreviewBody prompt={prompt} key={`${prompt.kind}-${prompt.commentMode}`} />;
  return (
    <div className="relative mx-auto h-[600px] w-full max-w-[340px] overflow-hidden rounded-[2rem] border-[6px] border-slate-900 bg-slate-100 shadow-xl">
      {/* A hint of the feed behind */}
      <div className="space-y-2 p-3 pt-8">
        {layout === "feed" && <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">{body}</div>}
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2 rounded-xl bg-white p-3">
            <div className="flex items-center gap-2">
              <span className="size-7 rounded-full bg-slate-200" />
              <span className="h-2.5 w-24 rounded bg-slate-200" />
            </div>
            <span className="block h-2.5 w-full rounded bg-slate-100" />
            <span className="block h-2.5 w-2/3 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      {layout !== "feed" && <div className="absolute inset-0 bg-black/40" />}
      {layout === "sheet" && <div className="absolute inset-x-0 bottom-0 max-h-[85%] overflow-y-auto rounded-t-3xl bg-white">{<div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-300" />}{body}</div>}
      {layout === "dialog" && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="max-h-[90%] w-full overflow-y-auto rounded-3xl bg-white">{body}</div>
        </div>
      )}
    </div>
  );
}

function PreviewBody({ prompt }: { prompt: AdminPromptInput }) {
  const [value, setValue] = useState<number | null>(null);
  const [option, setOption] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const a = ACCENT[prompt.accent ?? "green"];
  const kind = prompt.kind ?? "stars";
  const chosen = kind === "poll" ? !!option : kind === "open" ? true : value !== null;
  const showComment = kind === "open" || ((prompt.commentMode ?? "optional") !== "off" && chosen);

  if (sent) {
    return (
      <div className="space-y-2 p-6 text-center">
        <p className="text-3xl">✅</p>
        <p className="text-sm font-bold text-slate-900">{prompt.thanksMessage || "Thank you! Your answer helps us make myHoodora better for your neighbourhood."}</p>
        <button type="button" className="text-xs font-semibold text-primary underline" onClick={() => (setSent(false), setValue(null), setOption(null))}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="relative space-y-3 p-4 text-slate-900">
      <X className="absolute right-3 top-3 size-4 text-slate-400" aria-hidden />
      <div className="space-y-1.5 text-center">
        {prompt.emoji && (
          <span className="mx-auto flex size-12 items-center justify-center rounded-full text-2xl" style={{ background: a.bg }}>
            {prompt.emoji}
          </span>
        )}
        <p className="text-[15px] font-bold leading-snug">{prompt.question || "Your question"}</p>
        {prompt.detail && <p className="text-xs text-slate-500">{prompt.detail}</p>}
      </div>

      {kind === "stars" && (
        <div className="space-y-1 text-center">
          <div className="flex justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setValue(n)} aria-label={`${n} stars`}>
                <Star className={cn("size-7", value && n <= value ? "fill-[#F5B301] text-[#F5B301]" : "text-slate-300")} strokeWidth={1.6} />
              </button>
            ))}
          </div>
          <p className="text-xs font-semibold" style={{ color: value ? a.fg : "#94a3b8" }}>
            {value ? STAR_WORDS[value - 1] : "Tap a star"}
          </p>
        </div>
      )}

      {kind === "thumbs" && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { v: 1, e: "👍", l: "Yes" },
            { v: 0, e: "👎", l: "Not really" },
          ].map((c) => (
            <button key={c.v} type="button" onClick={() => setValue(c.v)} className="rounded-2xl border-2 py-3 text-center" style={{ background: value === c.v ? a.bg : "#f1f5f9", borderColor: value === c.v ? a.fg : "transparent", color: value === c.v ? a.fg : undefined }}>
              <span className="block text-2xl">{c.e}</span>
              <span className="text-xs font-semibold">{c.l}</span>
            </button>
          ))}
        </div>
      )}

      {kind === "nps" && (
        <div className="space-y-1">
          <div className="flex gap-0.5">
            {Array.from({ length: 11 }, (_, n) => (
              <button
                key={n}
                type="button"
                onClick={() => setValue(n)}
                className="flex h-8 flex-1 items-center justify-center rounded-md text-xs font-bold"
                style={{ background: value === n ? npsTone(n) : `${npsTone(n)}1f`, color: value === n ? "#fff" : npsTone(n) }}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Not likely</span>
            <span>Very likely</span>
          </div>
        </div>
      )}

      {kind === "poll" && (
        <div className="space-y-1.5">
          {(prompt.options?.length ? prompt.options : [{ id: "a", label: "Option" }]).map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setOption(o.id)}
              className="flex w-full items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm font-semibold"
              style={{ background: option === o.id ? a.bg : "#f1f5f9", borderColor: option === o.id ? a.fg : "transparent", color: option === o.id ? a.fg : undefined }}
            >
              {o.emoji && <span className="text-lg">{o.emoji}</span>}
              <span className="flex-1">{o.label || "Option"}</span>
              <span className="size-4 rounded-full border-2" style={{ borderColor: option === o.id ? a.fg : "#cbd5e1", background: option === o.id ? a.fg : "transparent" }} />
            </button>
          ))}
        </div>
      )}

      {showComment && (
        <div className="min-h-16 rounded-xl bg-slate-100 p-2.5 text-xs text-slate-400">
          {prompt.commentLabel || (kind === "open" ? "Write your answer" : prompt.commentMode === "required" ? "Tell us a little more" : "Tell us more (optional)")}
        </div>
      )}

      <button type="button" disabled={!chosen} onClick={() => setSent(true)} className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
        Send
      </button>
    </div>
  );
}
