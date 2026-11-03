import { cn } from "@myhoodora/ui/utils";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { imageSrcSet, imageUrl } from "@/lib/media/media-url";
import type { Listing } from "@/lib/api/types";
import { listingCategory } from "./constants";

/**
 * The square tile for a listing: its first photo, cropped to fill (a smart
 * crop around the subject for our own uploads), or the category icon when
 * there is no photo or it won't load. The frame is square from the first
 * paint, so a grid of cards never shifts as photos arrive.
 */
export function ListingPhoto({ listing, className }: { listing: Listing; className?: string }) {
  const photo = listing.photos[0];
  const { icon: Icon } = listingCategory(listing.category);
  const placeholder = (
    <div className={cn("flex aspect-square w-full items-center justify-center bg-secondary", className)}>
      <Icon className="size-10 text-primary/40" aria-hidden />
    </div>
  );
  if (!photo) return placeholder;
  return (
    <ImageWithFallback
      src={imageUrl(photo, { width: 720, aspect: 1 })}
      srcSet={imageSrcSet(photo, { aspect: 1 }, [320, 480, 720, 1080])}
      // The grid is 2 columns on phones, 3 from 768px and 4 from 1280px.
      sizes="(min-width: 1280px) 240px, (min-width: 768px) 30vw, 50vw"
      alt={listing.title}
      className={cn("aspect-square w-full object-cover", className)}
      errorFallback={placeholder}
    />
  );
}
