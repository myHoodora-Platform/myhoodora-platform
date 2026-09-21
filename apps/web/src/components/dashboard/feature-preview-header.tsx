import type { LucideIcon } from "lucide-react";
import { Badge } from "@myhoodora/ui/badge";

interface FeaturePreviewHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function FeaturePreviewHeader({
  icon: Icon,
  title,
  description,
}: FeaturePreviewHeaderProps) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-6" />
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            {title}
          </h2>
          <Badge variant="secondary">Preview</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          This page shows sample content while we build it. Buttons here don&apos;t save anything yet.
        </p>
      </div>
    </div>
  );
}
