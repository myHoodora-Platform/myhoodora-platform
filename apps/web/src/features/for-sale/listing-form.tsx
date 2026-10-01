"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { cn } from "@myhoodora/ui/utils";
import { Field, fieldAria, fieldInputClass } from "@/components/shared/field";
import { PhotoPicker } from "@/components/shared/image-picker";
import { useAuth } from "@/context/AuthContext";
import { createListing } from "@/lib/api/listings";
import { errorMessage } from "@/lib/api/client";
import type { Listing, ListingCategory, ListingCondition } from "@/lib/api/types";
import { CONDITIONS, LISTING_CATEGORIES } from "./constants";

const schema = z
  .object({
    title: z.string().trim().min(3, "Give the item a short name.").max(80, "Keep the title under 80 characters."),
    description: z.string().trim().max(1500, "Keep it under 1,500 characters."),
    category: z.string().min(1, "Choose a category."),
    condition: z.string().min(1, "Choose a condition."),
    free: z.boolean(),
    price: z.string().optional(),
    negotiable: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.free) return;
    const n = Number((v.price ?? "").replace(/[,\s₦]/g, ""));
    if (!v.price || !Number.isFinite(n) || n <= 0) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "Enter a price in naira, or mark it as free." });
    }
  });

type FormValues = z.infer<typeof schema>;

interface ListingFormProps {
  onDone: (listing: Listing) => void;
  onCancel: () => void;
}

/** "Sell or give away" — Nextdoor listing fields: title, description, price or free, category, photos (up to 10). */
export function ListingForm({ onDone, onCancel }: ListingFormProps) {
  const { user, profile } = useAuth();
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const { register, handleSubmit, watch, setValue, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", category: "", condition: "good", free: false, price: "", negotiable: true },
  });
  const { errors, isSubmitting } = formState;
  const free = watch("free");

  const submit = async (v: FormValues) => {
    if (!user || !profile?.neighborhoodId) return;
    try {
      const listing = await createListing(user, profile.neighborhoodId, {
        title: v.title,
        description: v.description,
        category: v.category as ListingCategory,
        condition: v.condition as ListingCondition,
        priceNaira: v.free ? null : Number((v.price ?? "").replace(/[,\s₦]/g, "")),
        negotiable: !v.free && v.negotiable,
        photos,
      });
      toast.success(v.free ? "Your free item is listed." : "Your item is listed.");
      onDone(listing);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't create the listing."));
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">
          Photos <span className="font-normal text-muted-foreground">(strongly recommended, up to 10)</span>
        </p>
        <PhotoPicker value={photos} onChange={setPhotos} onUploadingChange={setUploading} purpose="listing" disabled={isSubmitting} />
        {!photos.length && <p className="text-xs text-muted-foreground">Listings with a clear photo sell much faster.</p>}
      </div>

      <Field label="Title" htmlFor="title" error={errors.title?.message} hint="Just the item name, e.g. “Chest freezer, 200L”">
        <input {...register("title")} {...fieldAria("title", errors.title?.message, true)} className={fieldInputClass} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="category" error={errors.category?.message}>
          <select {...register("category")} {...fieldAria("category", errors.category?.message)} className={fieldInputClass}>
            <option value="">Choose…</option>
            {LISTING_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Condition" htmlFor="condition" error={errors.condition?.message}>
          <select {...register("condition")} {...fieldAria("condition", errors.condition?.message)} className={fieldInputClass}>
            {CONDITIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Price</legend>
        <div className="flex gap-2" role="radiogroup" aria-label="Selling or giving away">
          {[
            { free: false, label: "For sale" },
            { free: true, label: "Free" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={free === o.free}
              onClick={() => setValue("free", o.free, { shouldValidate: true })}
              className={cn(
                "h-10 flex-1 rounded-full border text-sm font-bold transition-colors",
                free === o.free ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        {!free && (
          <div className="space-y-2">
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-semibold text-muted-foreground">₦</span>
              <input
                {...register("price")}
                {...fieldAria("price", errors.price?.message)}
                inputMode="numeric"
                aria-label="Price in naira"
                placeholder="0"
                className={cn(fieldInputClass, "pl-8")}
              />
            </div>
            {errors.price && <p id="price-error" className="text-xs font-semibold text-destructive">{errors.price.message}</p>}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("negotiable")} className="size-4 accent-[var(--primary)]" />
              Price is negotiable
            </label>
          </div>
        )}
      </fieldset>

      <Field label="Description" htmlFor="description" optional error={errors.description?.message}>
        <textarea
          {...register("description")}
          {...fieldAria("description", errors.description?.message)}
          rows={4}
          placeholder="Size, colour, condition, where to pick up…"
          className={cn(fieldInputClass, "resize-y")}
        />
      </Field>

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting} disabled={uploading}>
          {free ? "List for free" : "List item"}
        </Button>
      </div>
    </form>
  );
}
