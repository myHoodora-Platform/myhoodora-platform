"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Globe, Lock, Users } from "lucide-react";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { cn } from "@myhoodora/ui/utils";
import { FilterChips } from "@/components/shared/filter-chips";
import { EmptyState, ErrorState, PageHeader, PreviewNotice } from "@/components/shared/states";
import { useAuth } from "@/context/AuthContext";
import { listGroups } from "@/lib/api/groups";
import { errorMessage } from "@/lib/api/client";
import { pluralize } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { Group } from "@/lib/api/types";
import { GROUP_CATEGORY } from "./constants";
import { GroupJoinButton } from "./group-join-button";

type Tab = "discover" | "yours";

function GroupCard({ group, onChange }: { group: Group; onChange: (g: Group) => void }) {
  const cat = GROUP_CATEGORY[group.category];
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <Link href={ROUTES.group(group._id)} className="flex items-start gap-3">
        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", cat.tone)}>
          <cat.icon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-bold hover:underline">{group.name}</h2>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {group.privacy === "private" ? <Lock className="size-3" aria-hidden /> : <Globe className="size-3" aria-hidden />}
            {group.privacy === "private" ? "Private" : "Open"} · {pluralize(group.memberCount, "member")}
          </p>
        </div>
      </Link>
      <p className="line-clamp-2 flex-1 text-sm text-foreground/80">{group.description}</p>
      <GroupJoinButton group={group} onChange={(membership) => onChange({ ...group, membership })} />
    </article>
  );
}

export function GroupsPage() {
  const { user, profile } = useAuth();
  const tab: Tab = useSearchParams().get("tab") === "yours" ? "yours" : "discover";
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !profile?.neighborhoodId) return;
    setError(null);
    try {
      setGroups(await listGroups(user, profile.neighborhoodId));
    } catch (err) {
      setError(errorMessage(err, "Couldn't load groups."));
    }
  }, [user, profile?.neighborhoodId]);

  useEffect(() => {
    void load();
  }, [load]);

  const yours = groups?.filter((g) => g.membership !== "none") ?? [];
  const list = tab === "yours" ? yours : (groups ?? []);
  const update = (next: Group) => setGroups((prev) => prev?.map((g) => (g._id === next._id ? next : g)) ?? null);

  return (
    <div className="space-y-4">
      <PageHeader title="Groups" description="Smaller circles within your neighbourhood: your street, safety watch, parents and more." />
      <PreviewNotice endpoint="groups" />
      <FilterChips
        label="Groups"
        items={[
          { id: "discover" as const, label: "Discover" },
          { id: "yours" as const, label: "Your groups", count: yours.length },
        ]}
        active={tab}
        hrefFor={(id) => (id === "discover" ? ROUTES.groups : `${ROUTES.groups}?tab=yours`)}
      />
      {error ? (
        <ErrorState title="Couldn't load groups" message={error} onRetry={() => void load()} />
      ) : groups === null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={Users}
          title="You haven't joined any groups"
          description="Find your street, the safety watch or neighbours who share your interests."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((g) => (
            <GroupCard key={g._id} group={g} onChange={update} />
          ))}
        </div>
      )}
    </div>
  );
}
