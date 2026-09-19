"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { VerifiedGate } from "@/components/shared/VerifiedGate";
import { FeaturePreviewHeader } from "@/components/dashboard/feature-preview-header";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import {
  ShoppingBag,
  Armchair,
  Bike,
  BookOpen,
  Shirt,
  Baby,
} from "lucide-react";

type ListingCategory =
  | "All"
  | "Furniture"
  | "Electronics"
  | "Fashion"
  | "Kids"
  | "Books";

const CATEGORIES: { label: ListingCategory; icon: typeof ShoppingBag }[] = [
  { label: "All", icon: ShoppingBag },
  { label: "Furniture", icon: Armchair },
  { label: "Electronics", icon: Bike },
  { label: "Fashion", icon: Shirt },
  { label: "Kids", icon: Baby },
  { label: "Books", icon: BookOpen },
];

interface Listing {
  title: string;
  price: string;
  category: ListingCategory;
  seller: string;
  distance: string;
  time: string;
  accent: string;
}

const mockListings: Listing[] = [
  {
    title: "3-Seater Fabric Sofa",
    price: "₦85,000",
    category: "Furniture",
    seller: "Chidinma",
    distance: "0.4km away",
    time: "2h ago",
    accent: "from-amber-200 to-orange-300",
  },
  {
    title: "Study Table & Chair Set",
    price: "₦22,000",
    category: "Furniture",
    seller: "Emeka",
    distance: "0.8km away",
    time: "5h ago",
    accent: "from-teal-200 to-emerald-300",
  },
  {
    title: 'Kids Bicycle, size 16"',
    price: "₦18,500",
    category: "Kids",
    seller: "Bukola",
    distance: "1.1km away",
    time: "Yesterday",
    accent: "from-sky-200 to-blue-300",
  },
  {
    title: "Bluetooth Speaker (JBL)",
    price: "₦30,000",
    category: "Electronics",
    seller: "Ifeanyi",
    distance: "0.6km away",
    time: "1d ago",
    accent: "from-violet-200 to-purple-300",
  },
  {
    title: "Ankara Fabric Bundle (6 yds)",
    price: "₦12,000",
    category: "Fashion",
    seller: "Amara",
    distance: "0.3km away",
    time: "3h ago",
    accent: "from-rose-200 to-pink-300",
  },
  {
    title: "Children's Storybook Set",
    price: "₦7,500",
    category: "Books",
    seller: "Grace",
    distance: "1.4km away",
    time: "2d ago",
    accent: "from-lime-200 to-green-300",
  },
];

export default function MarketplacePage() {
  const { runGatedAction } = useAuth();
  const [activeCategory, setActiveCategory] = useState<ListingCategory>("All");

  const handleListItem = () => {
    runGatedAction(() => {
      // No backend for this feature yet — demo action only.
    });
  };

  const listings =
    activeCategory === "All"
      ? mockListings
      : mockListings.filter((l) => l.category === activeCategory);

  return (
    <VerifiedGate>
      <div className="space-y-6">
        <FeaturePreviewHeader
          icon={ShoppingBag}
          title="Marketplace Listings"
          description="Buy, sell, and give away items with neighbours close to you."
        />

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => setActiveCategory(label)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors",
                  activeCategory === label
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={handleListItem} className="shrink-0">
            List an item
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {listings.map((listing, idx) => (
            <article
              key={idx}
              className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
            >
              <div
                className={cn(
                  "flex aspect-square items-center justify-center bg-gradient-to-br",
                  listing.accent,
                )}
              >
                <ShoppingBag className="size-8 text-white/70" />
              </div>
              <div className="space-y-1 p-3">
                <p className="text-sm font-bold text-slate-800">
                  {listing.price}
                </p>
                <p className="truncate text-xs font-semibold text-slate-600">
                  {listing.title}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {listing.distance} · {listing.time}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </VerifiedGate>
  );
}
