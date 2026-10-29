"use client";

import { AD_CTA_LABELS, type AdBackground, type AdminAdInput } from "@myhoodora/api-contract/ads";
import { Ellipsis, Play, VolumeX } from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import { initials } from "@/components/admin/format";

/** The app's announcement colours (apps/mobile/src/features/ads/ad-card.tsx), light mode. */
const BACKGROUNDS: Record<AdBackground, string> = {
  green: "bg-[#E7F4EE] text-[#0F5132]",
  blue: "bg-[#E8F0FE] text-[#1E3A8A]",
  amber: "bg-[#FEF3C7] text-[#92400E]",
  rose: "bg-[#FFE4E6] text-[#9F1239]",
  slate: "bg-[#F1F5F9] text-[#334155]",
};

const domainOf = (url?: string) => (url ? /^https?:\/\/(?:www\.)?([^/?#]+)/i.exec(url)?.[1] : undefined);

/**
 * How the ad will look in a neighbour's feed (the app's AdCard): advertiser and "Sponsored", the
 * text cut at three lines, the media, then the button bar. A guide, not pixel-perfect.
 */
export function AdPreview({ ad, sellerName }: { ad: AdminAdInput; sellerName?: string }) {
  const listings = ad.format === "listings";
  // A seller's listings show under the seller's own name, whatever the advertiser field says.
  const name = (listings && sellerName) || ad.advertiserName || "Advertiser";
  const media = ad.media?.[0];
  const cta = listings ? { label: `See all from ${name.split(" ")[0]}`, sub: "Items for sale" } : ad.ctaType ? { label: AD_CTA_LABELS[ad.ctaType], sub: ad.ctaType === "call" ? ad.ctaPhone : domainOf(ad.ctaUrl) } : null;
  return (
    <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-[2rem] border-[6px] border-slate-900 bg-slate-100 shadow-xl">
      <div className="h-6 bg-white" />
      <div className="space-y-2.5 bg-white py-3">
        <div className="flex items-center gap-2.5 px-4">
          {ad.advertiserLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- a preview of a stored file
            <img src={ad.advertiserLogoUrl} alt="" className="size-10 rounded-full object-cover" />
          ) : (
            <span className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{initials(name)}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-slate-900">{name}</p>
            <p className="text-xs text-slate-500">Sponsored</p>
          </div>
          <Ellipsis className="size-5 text-slate-500" aria-hidden />
        </div>

        {ad.format === "announcement" ? (
          <div className={cn("mx-4 rounded-2xl p-4 text-[17px] leading-snug", BACKGROUNDS[ad.background ?? "green"])}>{ad.primaryText || "Your announcement"}</div>
        ) : ad.primaryText ? (
          <p className="line-clamp-3 px-4 text-[15px] leading-snug text-slate-900">{ad.primaryText}</p>
        ) : null}

        {listings ? (
          <div className="flex gap-2 overflow-hidden px-4 pb-1" aria-label="Their items for sale appear here">
            {["₦25,000", "₦8,500", "Free"].map((price) => (
              <div key={price} className="w-[38%] shrink-0 overflow-hidden rounded-xl border border-slate-200">
                <div className="aspect-square w-full bg-slate-200" />
                <div className="p-2 text-xs">
                  <p className="font-semibold text-slate-900">{price}</p>
                  <p className="truncate text-slate-500">Their item</p>
                </div>
              </div>
            ))}
          </div>
        ) : ad.format === "carousel" ? (
          <div className="flex gap-2 overflow-x-auto px-4 pb-1">
            {(ad.cards?.length ? ad.cards : [{ imageUrl: "", headline: "Card", url: "" }]).map((c, i) => (
              <div key={i} className="w-[72%] shrink-0 overflow-hidden rounded-xl border border-slate-200">
                {c.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a preview of a stored file
                  <img src={c.imageUrl} alt="" className="aspect-square w-full object-cover" />
                ) : (
                  <div className="aspect-square w-full bg-slate-200" />
                )}
                <div className="flex items-center justify-between gap-2 p-2 text-xs">
                  <span className="truncate font-semibold text-slate-900">{c.headline || "Headline"}</span>
                  {cta && <span className="shrink-0 font-semibold text-primary">{cta.label}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : media ? (
          <div className="relative bg-slate-200">
            {media.kind === "video" ? (
              <>
                {media.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a preview of a stored file
                  <img src={media.posterUrl} alt="" className="aspect-square w-full object-cover" />
                ) : (
                  <div className="aspect-square w-full" />
                )}
                <Play className="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow" aria-hidden />
                <span className="absolute bottom-3 right-3 flex size-8 items-center justify-center rounded-full bg-black/55">
                  <VolumeX className="size-4 text-white" aria-hidden />
                </span>
              </>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- a preview of a stored file
              <img src={media.url} alt="" className="aspect-square w-full object-cover" />
            )}
          </div>
        ) : ad.format === "image" || ad.format === "video" || ad.format === "business" ? (
          <div className="flex aspect-square w-full items-center justify-center bg-slate-200 text-xs text-slate-500">{ad.format === "video" ? "Video" : "Image"}</div>
        ) : null}

        {cta && ad.format !== "carousel" && (
          <div className={cn("flex items-center justify-between gap-3 px-4 py-2.5", ad.format === "announcement" ? "" : "-mt-2.5 bg-slate-100")}>
            <div className="min-w-0">
              {ad.headline && <p className="truncate text-sm font-semibold text-slate-900">{ad.headline}</p>}
              {cta.sub && <p className="truncate text-xs text-slate-500">{cta.sub}</p>}
            </div>
            <span className="shrink-0 rounded-lg bg-primary/15 px-3 py-2 text-sm font-semibold text-primary">{cta.label}</span>
          </div>
        )}
      </div>
      <div className="h-10 bg-slate-100" />
    </div>
  );
}
