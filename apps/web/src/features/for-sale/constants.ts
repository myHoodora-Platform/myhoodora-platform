import {
  Armchair,
  Baby,
  BookOpen,
  Car,
  Package,
  Refrigerator,
  Shirt,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import type { ListingCategory, ListingCondition, ListingStatus } from "@/lib/api/types";

export const LISTING_CATEGORIES: { id: ListingCategory; label: string; icon: LucideIcon }[] = [
  { id: "furniture", label: "Furniture", icon: Armchair },
  { id: "electronics", label: "Electronics", icon: Smartphone },
  { id: "home_appliances", label: "Home appliances", icon: Refrigerator },
  { id: "fashion", label: "Fashion", icon: Shirt },
  { id: "kids", label: "Kids & baby", icon: Baby },
  { id: "books", label: "Books", icon: BookOpen },
  { id: "vehicles", label: "Vehicles", icon: Car },
  { id: "other", label: "Other", icon: Package },
];

export const CONDITIONS: { id: ListingCondition; label: string }[] = [
  { id: "new", label: "New" },
  { id: "like_new", label: "Like new" },
  { id: "good", label: "Good" },
  { id: "fair", label: "Fair" },
];

export function listingCategory(id: ListingCategory) {
  return LISTING_CATEGORIES.find((c) => c.id === id) ?? LISTING_CATEGORIES[LISTING_CATEGORIES.length - 1]!;
}

export function conditionLabel(id: ListingCondition): string {
  return CONDITIONS.find((c) => c.id === id)?.label ?? id;
}

export function listingStatusLabel(status: ListingStatus, isFree: boolean): string {
  if (status === "sold") return isFree ? "Given away" : "Sold";
  if (status === "pending") return "Pending";
  return "Available";
}

export const SAFETY_TIPS = [
  "Meet in a public place: your estate gate or a busy spot.",
  "Inspect the item before you pay.",
  "Never send money to someone you haven't met.",
];
