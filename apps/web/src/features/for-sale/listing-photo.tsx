import { cn } from "@myhoodora/ui/utils";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import type { Listing } from "@/lib/api/types";
import { listingCategory } from "./constants";

/** Listing photo, or a category-icon placeholder when there isn't one. */
export function ListingPhoto({ listing, className }: { listing: Listing; className?: string }) {
  const photo = listing.photos[0];
  if (photo) {
    return <ImageWithFallback src={photo} alt={listing.title} className={cn("w-full object-cover", className)} />;
  }
  const { icon: Icon } = listingCategory(listing.category);
  return (
    <div className={cn("flex w-full items-center justify-center bg-secondary", className)}>
      <Icon className="size-10 text-primary/40" aria-hidden />
    </div>
  );
}
