import type { User } from "@firebase/auth";
import type { Listing, ListingCategory, ListingCondition, ListingStatus } from "@myhoodora/api-contract/types";
import { apiFetch } from "@/core/api/client";

/** The web's labels (apps/web/src/features/for-sale/constants.ts). */
export const LISTING_CATEGORIES: { id: ListingCategory; label: string }[] = [
  { id: "furniture", label: "Furniture" },
  { id: "electronics", label: "Electronics" },
  { id: "home_appliances", label: "Home appliances" },
  { id: "fashion", label: "Fashion" },
  { id: "kids", label: "Kids & baby" },
  { id: "books", label: "Books" },
  { id: "vehicles", label: "Vehicles" },
  { id: "other", label: "Other" },
];

const CONDITIONS: Record<ListingCondition, string> = { new: "New", like_new: "Like new", good: "Good", fair: "Fair" };
export const conditionLabel = (c: ListingCondition) => CONDITIONS[c] ?? c;
export const categoryLabel = (c: ListingCategory) => LISTING_CATEGORIES.find((x) => x.id === c)?.label ?? "Other";

export function statusLabel(status: ListingStatus, free: boolean): string {
  if (status === "sold") return free ? "Given away" : "Sold";
  return status === "pending" ? "Pending" : "Available";
}

/** "free" or a category, as the For Sale chips choose. */
export type ListingFilter = "all" | "free" | ListingCategory;

export const listingKeys = {
  all: ["listings"] as const,
  list: (hoodId: string, filter: ListingFilter) => ["listings", hoodId, filter] as const,
  seller: (hoodId: string, uid: string) => ["listings", hoodId, "seller", uid] as const,
  one: (id: string) => ["listing", id] as const,
};

/** `GET /listings?neighborhoodId&category|free`: newest first, sold ones hidden (except your own). */
export function listListings(user: User, hoodId: string, filter: ListingFilter): Promise<Listing[]> {
  const params = new URLSearchParams({ neighborhoodId: hoodId, limit: "60" });
  if (filter === "free") params.set("free", "true");
  else if (filter !== "all") params.set("category", filter);
  return apiFetch<Listing[]>(user, `/listings?${params}`);
}

/** Someone's own listings: yours include sold ones, which only you see. */
export function listBySeller(user: User, hoodId: string, sellerUid: string): Promise<Listing[]> {
  return apiFetch<Listing[]>(user, `/listings?${new URLSearchParams({ neighborhoodId: hoodId, seller: sellerUid })}`);
}

export function getListing(user: User, id: string): Promise<Listing> {
  return apiFetch<Listing>(user, `/listings/${id}`);
}

export const CONDITION_OPTIONS: { id: ListingCondition; label: string }[] = (Object.keys(CONDITIONS) as ListingCondition[]).map((id) => ({ id, label: CONDITIONS[id] }));

export interface ListingForm {
  title: string;
  description: string;
  /** Digits as typed; ignored when free. */
  price: string;
  free: boolean;
  negotiable: boolean;
  category: ListingCategory | null;
  condition: ListingCondition | null;
}

export type ListingFormErrors = Partial<Record<"title" | "description" | "price" | "category" | "condition", string>>;

/** Naira from what was typed: digits only ("25,000" and "₦25000" both read 25000). */
export function parseNaira(typed: string): number | null {
  const digits = typed.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

/** The API's rules (CreateListingDto), checked before sending. */
export function listingErrors(f: ListingForm): ListingFormErrors | null {
  const e: ListingFormErrors = {};
  const title = f.title.trim();
  if (title.length < 3) e.title = "Give it a name of at least 3 characters.";
  else if (title.length > 80) e.title = "Keep the name to 80 characters.";
  if (f.description.length > 1500) e.description = "Keep the description to 1,500 characters.";
  if (!f.free) {
    const price = parseNaira(f.price);
    if (!price) e.price = "Add a price, or mark it as free.";
    else if (price > 1_000_000_000) e.price = "That price is too high.";
  }
  if (!f.category) e.category = "Choose a category.";
  if (!f.condition) e.condition = "Choose its condition.";
  return Object.keys(e).length ? e : null;
}

/** `POST /listings` into your Hood. A free item is never negotiable. */
export function createListing(user: User, hoodId: string, f: ListingForm, photos: string[]): Promise<Listing> {
  return apiFetch<Listing>(user, "/listings", {
    method: "POST",
    json: {
      neighborhoodId: hoodId,
      title: f.title.trim(),
      description: f.description.trim(),
      priceNaira: f.free ? null : parseNaira(f.price),
      negotiable: f.free ? false : f.negotiable,
      category: f.category,
      condition: f.condition,
      photos,
    },
  });
}
