"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BadgeCheck, Flag, MessageCircle, PackageX, Share2, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { cn } from "@myhoodora/ui/utils";
import { BackLink } from "@/components/shared/back-link";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ReportDialog } from "@/components/shared/report-dialog";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/context/AuthContext";
import { shareLink } from "@/features/feed/share";
import { useViewer } from "@/hooks/use-neighbourhood";
import { startConversation } from "@/lib/api/chat";
import { deleteListing, getListing, setListingStatus } from "@/lib/api/listings";
import { errorMessage } from "@/lib/api/client";
import { resolveAuthor } from "@/lib/api/users";
import { formatMonthYear, formatNaira } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { timeAgo } from "@/lib/time";
import type { Listing } from "@/lib/api/types";
import { SAFETY_TIPS, conditionLabel, listingCategory } from "./constants";
import { ListingPhoto } from "./listing-photo";

export function ListingDetail({ id }: { id: string }) {
  const router = useRouter();
  const { user, runGatedAction } = useAuth();
  const viewer = useViewer();
  const [listing, setListing] = useState<Listing | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [messaging, setMessaging] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    if (!user) return;
    getListing(user, id)
      .then(setListing)
      .catch((err) => setError(errorMessage(err, "Couldn't load this listing.")));
  }, [user, id]);

  if (error) return <ErrorState title="Couldn't load this listing" message={error} onRetry={() => window.location.reload()} />;
  if (listing === undefined) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="aspect-square rounded-2xl" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }
  if (listing === null) {
    return (
      <EmptyState
        icon={PackageX}
        title="This listing isn't available"
        description="It may have been sold or removed by the seller."
        action={<Button size="sm" onClick={() => router.push(ROUTES.forSale)}>Browse For Sale & Free</Button>}
      />
    );
  }

  const seller = resolveAuthor(listing.sellerUid, viewer);
  const isOwn = listing.sellerUid === user?.uid;
  const category = listingCategory(listing.category);

  // In-app chat: open (or reuse) a thread about this listing with the seller.
  const messageSeller = () =>
    runGatedAction(async () => {
      if (!user) return;
      setMessaging(true);
      try {
        const convo = await startConversation(user, listing.sellerUid, {
          type: "listing",
          id: listing._id,
          title: listing.title,
          photo: listing.photos[0],
          priceNaira: listing.priceNaira,
        });
        router.push(`${ROUTES.conversation(convo._id)}?draft=${encodeURIComponent(`Hi ${seller.displayName.split(" ")[0]}, is the “${listing.title}” still available?`)}`);
      } catch (err) {
        toast.error(errorMessage(err, "Couldn't start the conversation."));
        setMessaging(false);
      }
    });

  const changeStatus = async (status: Listing["status"]) => {
    if (!user) return;
    try {
      setListing(await setListingStatus(user, listing._id, status));
      toast.success(status === "sold" ? "Marked as sold." : status === "pending" ? "Marked as pending." : "Marked as available.");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't update the listing."));
    }
  };

  const remove = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      await deleteListing(user, listing._id);
      toast.success("Listing deleted.");
      router.push(ROUTES.forSale);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't delete the listing."));
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <BackLink fallback={ROUTES.forSale} label="For Sale & Free" />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
          <ListingPhoto listing={listing} className="aspect-square" />
          {listing.status !== "available" && (
            <span className="absolute top-3 left-3 rounded-full bg-foreground/80 px-3 py-1 text-sm font-bold text-background">
              {listing.status === "sold" ? "Sold" : "Pending"}
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <p className={cn("text-2xl font-bold", listing.priceNaira === null && "text-primary")}>
              {formatNaira(listing.priceNaira)}
              {listing.negotiable && listing.priceNaira !== null && (
                <span className="ml-2 align-middle text-sm font-semibold text-muted-foreground">Negotiable</span>
              )}
            </p>
            <h1 className="text-xl font-bold tracking-tight">{listing.title}</h1>
            <p className="text-sm text-muted-foreground">
              {category.label} · {conditionLabel(listing.condition)} · Listed {timeAgo(listing.createdAt)}
            </p>
          </div>

          {isOwn ? (
            <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-bold">Manage your listing</p>
              <div className="flex flex-wrap gap-2">
                {(["available", "pending", "sold"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={listing.status === s}
                    onClick={() => void changeStatus(s)}
                    className={cn(
                      "h-9 rounded-full border px-4 text-sm font-semibold capitalize",
                      listing.status === s ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" /> Delete listing
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button className="flex-1" onClick={messageSeller} loading={messaging} disabled={listing.status === "sold"}>
                <MessageCircle className="size-4" />
                Message seller
              </Button>
              <Button variant="outline" aria-label="Share listing" onClick={() => void shareLink(ROUTES.listing(listing._id), listing.title)}>
                <Share2 className="size-4" />
              </Button>
            </div>
          )}

          {listing.description && (
            <section className="space-y-1">
              <h2 className="text-sm font-bold">Details</h2>
              <p className="text-[15px] whitespace-pre-wrap text-foreground/90">{listing.description}</p>
            </section>
          )}

          <Link
            href={ROUTES.profile(listing.sellerUid)}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:bg-muted/50"
          >
            <UserAvatar person={seller} />
            <div className="min-w-0">
              <p className="flex items-center gap-1 font-bold">
                {seller.displayName}
                {seller.verified && <BadgeCheck className="size-4 text-primary" aria-label="Verified neighbour" />}
              </p>
              <p className="text-sm text-muted-foreground">
                {[seller.neighborhoodName, seller.neighbourSince && `Neighbour since ${formatMonthYear(seller.neighbourSince)}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </Link>

          <section className="rounded-2xl bg-info-soft/60 p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-info">
              <ShieldCheck className="size-4" aria-hidden /> Stay safe
            </h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/80">
              {SAFETY_TIPS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>

          {!isOwn && (
            <button
              type="button"
              onClick={() => setReporting(true)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              <Flag className="size-4" aria-hidden /> Report this listing
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this listing?"
        description="Neighbours will no longer see it."
        confirmLabel="Delete listing"
        destructive
        loading={deleting}
        onConfirm={remove}
      />
      <ReportDialog open={reporting} onOpenChange={setReporting} target={{ targetType: "listing", targetId: listing._id }} />
    </div>
  );
}
