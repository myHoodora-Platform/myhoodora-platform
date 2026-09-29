import { cn } from "@myhoodora/ui/utils";

/** Main work column + context column; stacks on smaller screens. */
export function DetailLayout({ main, aside }: { main: React.ReactNode; aside: React.ReactNode }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">{main}</div>
      <aside className="space-y-6">{aside}</aside>
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
  padded = true,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card", className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-bold">{title}</h2>
          {action}
        </div>
      )}
      <div className={cn(padded && "p-5")}>{children}</div>
    </section>
  );
}

export function KeyValues({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="divide-y divide-border text-sm">
      {items.map((i) => (
        <div key={i.label} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <dt className="text-muted-foreground">{i.label}</dt>
          <dd className="text-right font-medium">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
