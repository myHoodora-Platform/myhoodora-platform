import type { User } from "firebase/auth";
import { apiFetch } from "./client";
import { isLive } from "./config";
import { latency, load, mockId, save } from "./mock/store";
import { seedListings } from "./mock/seed";
import type { CreateListingInput, Listing, ListingCategory } from "./types";

const KEY = "listings";
const all = () => load<Listing[]>(KEY, seedListings);

export interface ListingFilters {
  category?: ListingCategory;
  freeOnly?: boolean;
  sellerUid?: string;
}

/** planned: GET /listings?neighborhoodId&category&free&seller */
export async function listListings(
  user: User,
  neighborhoodId: string,
  filters: ListingFilters = {},
): Promise<Listing[]> {
  if (isLive("listings")) {
    const params = new URLSearchParams({ neighborhoodId });
    if (filters.category) params.set("category", filters.category);
    if (filters.freeOnly) params.set("free", "true");
    if (filters.sellerUid) params.set("seller", filters.sellerUid);
    return apiFetch<Listing[]>(user, `/listings?${params}`);
  }
  await latency();
  return all()
    .filter((l) => l.status !== "sold" || l.sellerUid === user.uid)
    .filter((l) => !filters.category || l.category === filters.category)
    .filter((l) => !filters.freeOnly || l.priceNaira === null)
    .filter((l) => !filters.sellerUid || l.sellerUid === filters.sellerUid)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** planned: GET /listings/:id */
export async function getListing(user: User, id: string): Promise<Listing | null> {
  if (isLive("listings")) return apiFetch<Listing>(user, `/listings/${id}`);
  await latency();
  return all().find((l) => l._id === id) ?? null;
}

/** planned: POST /listings */
export async function createListing(
  user: User,
  neighborhoodId: string,
  input: CreateListingInput,
): Promise<Listing> {
  if (isLive("listings")) {
    return apiFetch<Listing>(user, "/listings", { method: "POST", json: { ...input, neighborhoodId } });
  }
  await latency(400);
  const listing: Listing = {
    ...input,
    _id: mockId("ml"),
    sellerUid: user.uid,
    neighborhoodId,
    status: "available",
    createdAt: new Date().toISOString(),
  };
  save(KEY, [listing, ...all()]);
  return listing;
}

/** planned: PATCH /listings/:id { status } (seller only). */
export async function setListingStatus(
  user: User,
  id: string,
  status: Listing["status"],
): Promise<Listing> {
  if (isLive("listings")) {
    return apiFetch<Listing>(user, `/listings/${id}`, { method: "PATCH", json: { status } });
  }
  await latency();
  let updated: Listing | undefined;
  save(
    KEY,
    all().map((l) => (l._id === id ? (updated = { ...l, status }) : l)),
  );
  if (!updated) throw new Error("Listing not found.");
  return updated;
}

/** planned: DELETE /listings/:id (seller only). */
export async function deleteListing(user: User, id: string): Promise<void> {
  if (isLive("listings")) {
    await apiFetch<void>(user, `/listings/${id}`, { method: "DELETE" });
    return;
  }
  await latency();
  save(KEY, all().filter((l) => l._id !== id));
}
