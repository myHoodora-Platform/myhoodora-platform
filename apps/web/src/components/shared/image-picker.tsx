"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Link2, X } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { useAuth } from "@/context/AuthContext";
import { resolveImageUrl, uploadImageFile } from "@/lib/api/media";
import { errorMessage } from "@/lib/api/client";
import { fieldInputClass } from "./field";
import { ImageWithFallback } from "./image-with-fallback";

interface ImagePickerProps {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

/** Upload a photo (Firebase Storage) or paste an image URL; shows a preview. */
export function ImagePicker({ value, onChange, disabled }: ImagePickerProps) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setUploading(true);
    try {
      onChange(await uploadImageFile(user, file));
    } catch (err) {
      toast.error(errorMessage(err, "Failed to upload image."));
    } finally {
      setUploading(false);
    }
  };

  const confirmUrl = () => {
    try {
      onChange(resolveImageUrl(urlInput));
      setUrlMode(false);
      setUrlInput("");
    } catch (err) {
      toast.error(errorMessage(err, "Invalid image URL."));
    }
  };

  if (value) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-border">
        <ImageWithFallback src={value} alt="Selected photo" className="max-h-64 w-full object-cover" />
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Remove photo"
          className="absolute top-2 right-2 flex size-9 items-center justify-center rounded-full bg-foreground/70 text-background hover:bg-foreground/85"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          loading={uploading}
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="size-4" />
          Add photo
        </Button>
        <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setUrlMode((m) => !m)}>
          <Link2 className="size-4" />
          Paste image URL
        </Button>
      </div>
      {urlMode && (
        <div className="flex gap-2">
          <input
            aria-label="Image URL"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmUrl();
              }
            }}
            placeholder="https://example.com/photo.jpg"
            className={fieldInputClass}
          />
          <Button size="sm" onClick={confirmUrl}>
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
