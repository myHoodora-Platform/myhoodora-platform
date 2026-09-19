"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAdminData } from "@/context/AdminDataContext";
import { ConfirmOverlay } from "@/components/shared/confirm-overlay";
import { Badge } from "@myhoodora/ui/badge";
import { Button } from "@myhoodora/ui/button";
import { Input } from "@myhoodora/ui/input";
import { Textarea } from "@myhoodora/ui/textarea";
import { Checkbox } from "@myhoodora/ui/checkbox";
import { Skeleton } from "@myhoodora/ui/skeleton";
import type { NeighborhoodSummary } from "@/lib/firebase/auth";
import {
  MapPin,
  Search,
  Plus,
  Trash2,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface FormState {
  name: string;
  city: string;
  country: string;
  radiusMeters: string;
  description: string;
  lng: string;
  lat: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  city: "",
  country: "",
  radiusMeters: "1500",
  description: "",
  lng: "",
  lat: "",
  isActive: true,
};

export default function AdminNeighborhoodsPage() {
  const {
    neighborhoods,
    neighborhoodsLoading,
    createNeighborhood,
    deleteNeighborhood,
    checkNearbyNeighborhoods,
  } = useAdminData();

  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [checkingNearby, setCheckingNearby] = useState(false);
  const [nearbyMatches, setNearbyMatches] = useState<NeighborhoodSummary[]>(
    [],
  );
  const [pendingDelete, setPendingDelete] =
    useState<NeighborhoodSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return neighborhoods;
    return neighborhoods.filter((n) =>
      `${n.name} ${n.city} ${n.country}`.toLowerCase().includes(q),
    );
  }, [neighborhoods, search]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleCheckNearby = async () => {
    const lng = parseFloat(form.lng);
    const lat = parseFloat(form.lat);
    if (Number.isNaN(lng) || Number.isNaN(lat)) {
      toast.error("Enter valid coordinates to check for overlap.");
      return;
    }
    setCheckingNearby(true);
    try {
      const radius = parseInt(form.radiusMeters, 10) || 1500;
      const matches = await checkNearbyNeighborhoods({ lng, lat }, radius);
      setNearbyMatches(matches);
      if (matches.length === 0) {
        toast.success("No overlapping neighborhoods nearby.");
      }
    } catch {
      toast.error("Failed to check nearby neighborhoods.");
    } finally {
      setCheckingNearby(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.city.trim() || !form.country.trim()) {
      toast.error("Name, city, and country are required.");
      return;
    }
    const radiusMeters = parseInt(form.radiusMeters, 10);
    if (!radiusMeters || radiusMeters <= 0) {
      toast.error("Enter a valid radius in meters.");
      return;
    }

    const lng = parseFloat(form.lng);
    const lat = parseFloat(form.lat);
    const hasCoords = !Number.isNaN(lng) && !Number.isNaN(lat);

    setSubmitting(true);
    try {
      await createNeighborhood({
        name: form.name.trim(),
        city: form.city.trim(),
        country: form.country.trim(),
        radiusMeters,
        description: form.description.trim() || undefined,
        isActive: form.isActive,
        location: hasCoords
          ? { type: "Point", coordinates: [lng, lat] }
          : undefined,
      });
      toast.success(`"${form.name.trim()}" added.`);
      setForm(EMPTY_FORM);
      setNearbyMatches([]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create neighborhood.";
      toast.error(
        message.toLowerCase().includes("duplicate") ||
          message.toLowerCase().includes("e11000")
          ? `A neighborhood named "${form.name.trim()}" already exists.`
          : message,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteNeighborhood(pendingDelete._id);
      toast.success(`"${pendingDelete.name}" removed.`);
      setPendingDelete(null);
    } catch {
      toast.error("Failed to delete neighborhood.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-sm font-bold tracking-tight text-slate-900">
            Add neighborhood
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Writes directly to the neighborhoods collection — real data, no
            mock layer.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Name
            </label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Lekki Phase 1"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Radius (meters)
            </label>
            <Input
              type="number"
              value={form.radiusMeters}
              onChange={(e) => set("radiusMeters", e.target.value)}
              placeholder="1500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold tracking-wider text-muted-foreground uppercase">
              City
            </label>
            <Input
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              placeholder="Lagos"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Country
            </label>
            <Input
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
              placeholder="Nigeria"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold tracking-wider text-muted-foreground uppercase">
            Description (optional)
          </label>
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Short description shown to residents..."
            className="min-h-16"
          />
        </div>

        <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Coordinates (optional)
            </label>
            <button
              type="button"
              onClick={handleCheckNearby}
              disabled={checkingNearby}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
            >
              {checkingNearby ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Search className="size-3" />
              )}
              Check overlap
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              step="any"
              value={form.lng}
              onChange={(e) => {
                set("lng", e.target.value);
                setNearbyMatches([]);
              }}
              placeholder="Longitude"
              className="py-2.5"
            />
            <Input
              type="number"
              step="any"
              value={form.lat}
              onChange={(e) => {
                set("lat", e.target.value);
                setNearbyMatches([]);
              }}
              placeholder="Latitude"
              className="py-2.5"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Used to match residents during onboarding verification.
          </p>

          {nearbyMatches.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Overlaps with {nearbyMatches.map((m) => m.name).join(", ")}{" "}
                within this radius — residents there may match both.
              </span>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Checkbox
            checked={form.isActive}
            onCheckedChange={(v) => set("isActive", v === true)}
          />
          Active immediately
        </label>

        <Button className="w-full" onClick={handleCreate} disabled={submitting}>
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Add neighborhood
        </Button>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search neighborhoods..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-primary"
          />
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-tight text-slate-900">
              All neighborhoods
            </h2>
            <span className="text-xs text-muted-foreground">
              {neighborhoodsLoading ? "…" : `${neighborhoods.length} total`}
            </span>
          </div>

          {neighborhoodsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-muted-foreground">
              No neighborhoods match your search.
            </p>
          ) : (
            <div className="max-h-[560px] space-y-2 overflow-y-auto">
              {filtered.map((n) => (
                <div
                  key={n._id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <MapPin className="size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">
                        {n.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {n.city}, {n.country}
                        {n.radiusMeters ? ` · ${n.radiusMeters}m radius` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={n.isActive === false ? "secondary" : "success"}>
                      {n.isActive === false ? "Inactive" : "Active"}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(n)}
                      className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Delete ${n.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {pendingDelete && (
        <ConfirmOverlay
          icon={Trash2}
          title={`Delete "${pendingDelete.name}"?`}
          description="This permanently removes the neighborhood. Residents matched to it will need to be re-verified against another neighborhood."
          confirmLabel={deleting ? "Deleting..." : "Delete neighborhood"}
          destructive
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
