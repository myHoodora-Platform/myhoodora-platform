"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminToolbar, FilterSelect, SearchBox, StatusTabs } from "@/components/admin/admin-toolbar";
import { DataTable, countLabel } from "@/components/admin/data-table";
import { EmptyBody } from "@/components/admin/admin-states";
import { StatusBadge } from "@/components/admin/status-badge";
import { CATEGORY_LABEL, timeAgo } from "@/components/admin/format";
import { listPosts } from "@/lib/api/admin/content";
import { useAdminQuery } from "../use-admin-query";
import { useListParams } from "../use-list-params";
import { ContentActionDialog, type ContentTarget } from "./content-action";

type View = "all" | "reported" | "removed";

export function PostsPage() {
  const { get, set, page, key } = useListParams<"view" | "category">({ view: "all" });
  const view = get("view") as View;
  const posts = useAdminQuery(
    (u) =>
      listPosts(u, {
        q: get("q") || undefined,
        category: get("category") || undefined,
        reported: view === "reported" || undefined,
        status: view === "removed" ? "removed" : undefined,
        page,
      }),
    key,
  );
  const [target, setTarget] = useState<ContentTarget | null>(null);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        crumbs={[{ label: "Content" }, { label: "Posts" }]}
        title="Posts"
        description="Everything neighbours post, including alerts, events, polls and recommendations. Open one to see it in context with its comments."
      />
      <StatusTabs<View>
        active={view}
        onChange={(v) => set({ view: v })}
        tabs={[
          { value: "all", label: "All posts" },
          { value: "reported", label: "With open reports" },
          { value: "removed", label: "Removed" },
        ]}
      />
      <AdminToolbar count={countLabel(posts.data, "post")}>
        <SearchBox value={get("q")} onSearch={(q) => set({ q })} placeholder="Search text, author or Hood" />
        <FilterSelect label="Type" value={get("category")} onChange={(v) => set({ category: v })} options={Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))} />
      </AdminToolbar>
      <DataTable
        page={posts.data}
        loading={posts.loading}
        refreshing={posts.refreshing}
        error={posts.error}
        onRetry={posts.refetch}
        onPage={(p) => set({ page: String(p) })}
        rowKey={(p) => p.id}
        rowHref={(p) => `/admin/posts/${p.id}`}
        primary={(p) => (
          <div>
            <p className="line-clamp-2 text-sm font-semibold">{p.message}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {p.author.displayName} · {p.hood?.name ?? "—"}
            </p>
          </div>
        )}
        columns={[
          { header: "Post", className: "min-w-[280px]", cell: (p) => <span className="line-clamp-2">{p.message}</span> },
          { header: "Author", cell: (p) => <span className="whitespace-nowrap">{p.author.displayName}</span> },
          { header: "Hood", cell: (p) => p.hood?.name ?? "—" },
          {
            header: "Type",
            mobile: true,
            cell: (p) => (
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                {CATEGORY_LABEL[p.category] ?? p.category}
                {p.urgent && <StatusBadge status="urgent" />}
              </span>
            ),
          },
          { header: "Engagement", cell: (p) => <span className="whitespace-nowrap text-muted-foreground">{p.reactions} · {p.comments} comments</span> },
          {
            header: "Status",
            mobile: true,
            cell: (p) => (p.status === "removed" ? <StatusBadge status="removed" /> : p.openReports ? <StatusBadge status="escalated" label={`${p.openReports} report${p.openReports > 1 ? "s" : ""}`} /> : <StatusBadge status="visible" />),
          },
          { header: "Posted", mobile: true, cell: (p) => <span className="whitespace-nowrap text-muted-foreground">{timeAgo(p.createdAt)}</span> },
        ]}
        actions={[
          { label: "Remove post", destructive: true, hidden: (p) => p.status === "removed", onSelect: (p) => setTarget({ type: "post", id: p.id, label: p.message.slice(0, 60), action: "remove" }) },
          { label: "Restore post", hidden: (p) => p.status !== "removed", onSelect: (p) => setTarget({ type: "post", id: p.id, label: p.message.slice(0, 60), action: "restore" }) },
        ]}
        empty={<EmptyBody icon={FileText} title="No posts here" description={view === "removed" ? "Nothing has been removed." : "Try another search or filter."} />}
      />
      <ContentActionDialog target={target} onClose={() => setTarget(null)} onDone={() => void posts.refetch()} />
    </div>
  );
}
