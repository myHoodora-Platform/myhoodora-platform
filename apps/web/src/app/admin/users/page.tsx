"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAdminData } from "@/context/AdminDataContext";
import { Avatar, AvatarFallback } from "@myhoodora/ui/avatar";
import { Badge } from "@myhoodora/ui/badge";
import { Button } from "@myhoodora/ui/button";
import { Checkbox } from "@myhoodora/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@myhoodora/ui/select";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { ConfirmOverlay } from "@/components/shared/confirm-overlay";
import {
  Search,
  ShieldCheck,
  ShieldOff,
  ShieldX,
  MapPin,
  CalendarDays,
} from "lucide-react";
import type { MockUser, VerificationStatus } from "@/lib/admin/mock-data";

const STATUS_BADGE: Record<
  VerificationStatus,
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  verified: { label: "Verified", variant: "success" },
  unverified: { label: "Unverified", variant: "warning" },
  banned: { label: "Restricted", variant: "destructive" },
};

type StatusFilter = "all" | VerificationStatus;

const FILTERS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: "all" },
  { label: "Verified", value: "verified" },
  { label: "Unverified", value: "unverified" },
  { label: "Restricted", value: "banned" },
];

function initial(u: MockUser) {
  return u.displayName.charAt(0).toUpperCase();
}

function AdminUsersPageContent() {
  const {
    users,
    neighborhoods,
    neighborhoodsLoading,
    verifyUser,
    restrictUser,
    unrestrictUser,
    bulkVerify,
    bulkRestrict,
  } = useAdminData();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedUid, setSelectedUid] = useState<string | null>(
    searchParams.get("uid"),
  );
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [verifyNeighborhoodId, setVerifyNeighborhoodId] = useState("");
  const [bulkNeighborhoodId, setBulkNeighborhoodId] = useState("");
  const [confirm, setConfirm] = useState<
    null | "restrict" | "unrestrict" | "bulk-restrict" | "bulk-verify"
  >(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesSearch =
        !q || `${u.displayName} ${u.email}`.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" || u.verificationStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [users, search, statusFilter]);

  const selectedUser = users.find((u) => u.uid === selectedUid) ?? null;
  const allSelected =
    filtered.length > 0 && selectedUids.size === filtered.length;

  const toggleSelect = (uid: string) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedUids(allSelected ? new Set() : new Set(filtered.map((u) => u.uid)));
  };

  const handleVerify = () => {
    if (!selectedUser || !verifyNeighborhoodId) {
      toast.error("Choose a neighborhood first.");
      return;
    }
    verifyUser(selectedUser.uid, verifyNeighborhoodId);
    toast.success(`${selectedUser.displayName} has been verified.`);
    setVerifyNeighborhoodId("");
  };

  const handleBulkVerifyConfirmed = () => {
    if (!bulkNeighborhoodId) {
      toast.error("Choose a neighborhood first.");
      return;
    }
    bulkVerify(Array.from(selectedUids), bulkNeighborhoodId);
    toast.success(`${selectedUids.size} users verified.`);
    setSelectedUids(new Set());
    setBulkNeighborhoodId("");
    setConfirm(null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* Left: searchable/filterable list */}
      <div className="flex min-h-[70vh] flex-col rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary focus:bg-white"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={
                  statusFilter === f.value
                    ? "shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground"
                    : "shrink-0 rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
                }
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
            {selectedUids.size > 0
              ? `${selectedUids.size} selected`
              : `${filtered.length} users`}
          </label>
        </div>

        {selectedUids.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-primary/5 p-3">
            <Select value={bulkNeighborhoodId} onValueChange={setBulkNeighborhoodId}>
              <SelectTrigger className="h-auto w-48 py-2 text-xs shadow-none">
                <SelectValue placeholder="Neighborhood..." />
              </SelectTrigger>
              <SelectContent>
                {neighborhoods.map((n) => (
                  <SelectItem key={n._id} value={n._id}>
                    {n.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => setConfirm("bulk-verify")}>
              Verify selected
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirm("bulk-restrict")}
            >
              Restrict selected
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No users match your search.
            </p>
          ) : (
            filtered.map((u) => {
              const badge = STATUS_BADGE[u.verificationStatus];
              return (
                <div
                  key={u.uid}
                  className={
                    selectedUid === u.uid
                      ? "flex items-center gap-3 border-b border-slate-100 bg-primary/5 p-3"
                      : "flex items-center gap-3 border-b border-slate-100 p-3 hover:bg-slate-50"
                  }
                >
                  <Checkbox
                    checked={selectedUids.has(u.uid)}
                    onCheckedChange={() => toggleSelect(u.uid)}
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedUid(u.uid)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <Avatar className="size-9 shrink-0">
                      <AvatarFallback className="text-xs">
                        {initial(u)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {u.displayName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {u.email}
                      </p>
                    </div>
                    <Badge variant={badge.variant} className="shrink-0">
                      {badge.label}
                    </Badge>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: detail panel */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        {!selectedUser ? (
          <div className="flex h-full min-h-[50vh] flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <ShieldCheck className="mb-3 size-8 text-slate-300" />
            Select a user to view details
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Avatar className="size-14">
                <AvatarFallback className="text-lg">
                  {initial(selectedUser)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-slate-900">
                  {selectedUser.displayName}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {selectedUser.email}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant={STATUS_BADGE[selectedUser.verificationStatus].variant}>
                {STATUS_BADGE[selectedUser.verificationStatus].label}
              </Badge>
              <Badge variant={selectedUser.role === "member" ? "outline" : "default"}>
                {selectedUser.role}
              </Badge>
            </div>

            <div className="space-y-2 text-sm text-slate-600">
              <p className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0 text-slate-400" />
                {selectedUser.neighborhoodName ?? "No neighborhood assigned"}
              </p>
              <p className="flex items-center gap-2">
                <CalendarDays className="size-4 shrink-0 text-slate-400" />
                Joined {selectedUser.joinedAt}
              </p>
            </div>

            <div className="space-y-3 border-t border-slate-100 pt-4">
              {selectedUser.verificationStatus !== "verified" && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold tracking-wider text-muted-foreground uppercase">
                    Manually verify
                  </label>
                  <Select
                    value={verifyNeighborhoodId}
                    onValueChange={setVerifyNeighborhoodId}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          neighborhoodsLoading
                            ? "Loading neighborhoods..."
                            : "Choose a neighborhood"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {neighborhoods.map((n) => (
                        <SelectItem key={n._id} value={n._id}>
                          {n.name}, {n.city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button className="w-full" onClick={handleVerify}>
                    <ShieldCheck className="size-4" />
                    Verify user
                  </Button>
                </div>
              )}

              {selectedUser.verificationStatus === "banned" ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setConfirm("unrestrict")}
                >
                  <ShieldOff className="size-4" />
                  Lift restriction
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:bg-destructive/5"
                  onClick={() => setConfirm("restrict")}
                >
                  <ShieldX className="size-4" />
                  Restrict user
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {confirm === "restrict" && selectedUser && (
        <ConfirmOverlay
          icon={ShieldX}
          title="Restrict this user?"
          description={`${selectedUser.displayName} will lose access to posting, RSVPing, and listing items until the restriction is lifted.`}
          confirmLabel="Restrict user"
          destructive
          onConfirm={() => {
            restrictUser(selectedUser.uid);
            toast.success(`${selectedUser.displayName} has been restricted.`);
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm === "unrestrict" && selectedUser && (
        <ConfirmOverlay
          icon={ShieldOff}
          title="Lift this restriction?"
          description={`${selectedUser.displayName} will regain normal access to the platform.`}
          confirmLabel="Lift restriction"
          onConfirm={() => {
            unrestrictUser(selectedUser.uid);
            toast.success(`Restriction lifted for ${selectedUser.displayName}.`);
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm === "bulk-restrict" && (
        <ConfirmOverlay
          icon={ShieldX}
          title={`Restrict ${selectedUids.size} users?`}
          description="They will all lose access to posting, RSVPing, and listing items until the restriction is lifted."
          confirmLabel="Restrict selected"
          destructive
          onConfirm={() => {
            bulkRestrict(Array.from(selectedUids));
            toast.success(`${selectedUids.size} users restricted.`);
            setSelectedUids(new Set());
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm === "bulk-verify" && (
        <ConfirmOverlay
          icon={ShieldCheck}
          title={`Verify ${selectedUids.size} users?`}
          description="They will all be marked verified with the neighborhood you selected."
          confirmLabel="Verify selected"
          onConfirm={handleBulkVerifyConfirmed}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function UsersPageSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Skeleton className="h-[70vh] rounded-2xl" />
      <Skeleton className="h-[70vh] rounded-2xl" />
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<UsersPageSkeleton />}>
      <AdminUsersPageContent />
    </Suspense>
  );
}
