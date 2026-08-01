"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@myhoodora/ui/button";

export function BackButton({ className = "" }: { className?: string }) {
  const router = useRouter();

  return (
    <Button
      variant="outline"
      onClick={() => router.back()}
      className={className}
    >
      <ArrowLeft className="size-5" />
      Go Back
    </Button>
  );
}
