"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, ShoppingBag } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { FilterChips, type ChipItem } from "@/components/shared/filter-chips";
import { ResponsiveModal } from "@/components/shared/responsive-modal";
import { EmptyState, ErrorState, PageHeader, PreviewNotice } from "@/components/shared/states";
import { useAuth } from "@/context/AuthContext";
import { listListings } from "@/lib/api/listings";
import { errorMessage } from "@/lib/api/client";
import { useRealtime, useRealtimeResync } from "@/lib/realtime/use-realtime";
import { ROUTES } from "@/lib/routes";
import type { Listing, ListingCategory } from "@/lib/api/types";
import { LISTING_CATEGORIES } from "./constants";
import { ListingCard } from "./listing-card";
import { ListingForm } from "./listing-form";

type Filter = "all" | "free" | "mine" | ListingCategory;

const CHIPS: ChipItem<Filter>[] = [
  { id: "all", label: "All" },
  { id: "free", label: "Free" },
  ...LISTING_CATEGORIES.map((c) => ({ id: c.id, label: c.label, icon: c.icon })),
  { id: "mine", label: "Your listings" },
];

export function ForSalePage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { user, profile, runGatedAction } = useAuth();
  const raw = params.get("filter");
  const filter: Filter = CHIPS.some((c) => c.id === raw) ? (raw as Filter) : "all";
  const selling = params.get("sell") === "1";

  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** `quiet`: a live refresh keeps the grid on screen instead of flashing skeletons. */
  const load = useCallback(async (quiet = false) => {
    if (!user || !profile?.neighborhoodId) return;
    if (!quiet) {
      setError(null);
      setListings(null);
    }
    try {
      setListings(
        await listListings(user, profile.neighborhoodId, {
          freeOnly: filter === "free",
          sellerUid: filter === "mine" ? user.uid : undefined,
          category: filter !== "all" && filter !== "free" && filter !== "mine" ? filter : undefined,
        }),
      );
    } catch (err) {
      if (!quiet) setError(errorMessage(err, "Couldn't load listings."));
    }
  }, [user, profile?.neighborhoodId, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live: neighbours' new, sold or removed items show up without a reload.
  useRealtime(["listing.created", "listing.updated"], () => void load(true));
  useRealtimeResync(() => void load(true));

  const setSelling = (open: boolean) => {
    const next = new URLSearchParams(params);
    if (open) next.set("sell", "1");
    else next.delete("sell");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="For Sale & Free"
        description="Buy, sell and give away items with verified neighbours."
        actions={
          <Button size="sm" onClick={() => runGatedAction(() => setSelling(true))}>
            <Plus className="size-4" />
            Sell or give away
          </Button>
        }
      />
      <PreviewNotice endpoint="listings" />
      <FilterChips
        label="Categories"
        items={CHIPS}
        active={filter}
        hrefFor={(id) => (id === "all" ? ROUTES.forSale : `${ROUTES.forSale}?filter=${id}`)}
      />

      {error ? (
        <ErrorState title="Couldn't load listings" message={error} onRetry={() => void load()} />
      ) : listings === null ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={filter === "mine" ? "You haven't listed anything yet" : "Nothing here yet"}
          description="Have something you no longer need? Sell it or give it away to a neighbour."
          action={
            <Button size="sm" onClick={() => runGatedAction(() => setSelling(true))}>
              Sell or give away
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {listings.map((l) => (
            <ListingCard key={l._id} listing={l} />
          ))}
        </div>
      )}

      <ResponsiveModal
        open={selling}
        onOpenChange={setSelling}
        title="Sell or give away"
        description="Listed to verified neighbours in your neighbourhood."
        className="sm:max-w-xl"
      >
        <ListingForm
          onCancel={() => setSelling(false)}
          onDone={(listing) => router.push(ROUTES.listing(listing._id))}
        />
      </ResponsiveModal>
    </div>
  );
}
