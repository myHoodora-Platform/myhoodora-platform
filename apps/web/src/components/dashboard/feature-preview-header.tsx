import type { LucideIcon } from "lucide-react";

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
        <h2 className="text-lg font-bold tracking-tight text-slate-900">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
