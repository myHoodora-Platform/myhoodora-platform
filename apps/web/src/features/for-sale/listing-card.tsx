import Link from "next/link";
import { cn } from "@myhoodora/ui/utils";
import { formatNaira } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { timeAgo } from "@/lib/time";
import type { Listing } from "@/lib/api/types";
import { ListingPhoto } from "./listing-photo";
import { listingStatusLabel, listingStatusTone } from "./constants";

export function ListingCard({ listing }: { listing: Listing }) {
  const free = listing.priceNaira === null;
  return (
    <Link
      href={ROUTES.listing(listing._id)}
      className="group block overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <div className="relative">
        <ListingPhoto listing={listing} className="aspect-square" />
        {listing.status !== "available" && (
          <span className={cn("absolute top-2 left-2 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm", listingStatusTone(listing.status, free))}>
            {listingStatusLabel(listing.status, free)}
          </span>
        )}
      </div>
      <div className="space-y-0.5 p-3">
        <p className={cn("text-base font-bold", free ? "text-primary" : "text-foreground")}>
          {formatNaira(listing.priceNaira)}
          {listing.negotiable && !free && <span className="ml-1 text-xs font-medium text-muted-foreground">neg.</span>}
        </p>
        <p className="line-clamp-2 text-sm font-medium text-foreground/90 group-hover:underline">{listing.title}</p>
        <p className="text-xs text-muted-foreground">{timeAgo(listing.createdAt)}</p>
      </div>
    </Link>
  );
}
