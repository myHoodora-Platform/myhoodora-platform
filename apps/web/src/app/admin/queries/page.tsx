"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAdminData } from "@/context/AdminDataContext";
import { Badge } from "@myhoodora/ui/badge";
import { Button } from "@myhoodora/ui/button";
import { Textarea } from "@myhoodora/ui/textarea";
import { Search, Clock, ArrowRight, CheckCircle2 } from "lucide-react";
import type {
  MockQuery,
  QueryStatus,
  QueryPriority,
} from "@/lib/admin/mock-data";

const COLUMNS: { status: QueryStatus; label: string }[] = [
  { status: "open", label: "Open" },
  { status: "in_progress", label: "In Progress" },
  { status: "resolved", label: "Resolved" },
];

const PRIORITY_BADGE: Record<
  QueryPriority,
  { label: string; variant: "destructive" | "warning" | "secondary" }
> = {
  high: { label: "High", variant: "destructive" },
  normal: { label: "Normal", variant: "warning" },
  low: { label: "Low", variant: "secondary" },
};

const CANNED_RESPONSES = [
  "Thanks for reaching out — we're looking into this now.",
  "This has been resolved. Let us know if you run into it again!",
  "Could you share a few more details so we can investigate?",
];

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function nextStatus(status: QueryStatus): QueryStatus | null {
  if (status === "open") return "in_progress";
  if (status === "in_progress") return "resolved";
  return null;
}

function QueryCard({ query }: { query: MockQuery }) {
  const { moveQuery, respondToQuery } = useAdminData();
  const [expanded, setExpanded] = useState(false);
  const [response, setResponse] = useState(query.adminResponse ?? "");
  const priority = PRIORITY_BADGE[query.priority];
  const next = nextStatus(query.status);
  const nextLabel = COLUMNS.find((c) => c.status === next)?.label;

  const handleRespond = () => {
    if (!response.trim()) {
      toast.error("Write a response first.");
      return;
    }
    respondToQuery(query.id, response.trim());
    toast.success("Response sent and query marked resolved.");
    setExpanded(false);
  };

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold text-slate-800">{query.subject}</p>
          <Badge variant={priority.variant} className="shrink-0">
            {priority.label}
          </Badge>
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {query.message}
        </p>
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{query.userName}</span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {timeAgo(query.createdAt)}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-600">{query.message}</p>
          {query.adminResponse && (
            <div className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800">
              <span className="font-bold">Your response: </span>
              {query.adminResponse}
            </div>
          )}
          {query.status !== "resolved" && (
            <>
              <Textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Write a response..."
                className="min-h-20 text-sm"
              />
              <div className="flex flex-wrap gap-1.5">
                {CANNED_RESPONSES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setResponse(c)}
                    className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    {c.length > 28 ? `${c.slice(0, 28)}…` : c}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="flex-1" onClick={handleRespond}>
                  <CheckCircle2 className="size-3.5" />
                  Respond & resolve
                </Button>
                {next && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      moveQuery(query.id, next);
                      toast.success(`Moved to ${nextLabel}.`);
                    }}
                  >
                    <ArrowRight className="size-3.5" />
                    Move to {nextLabel}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminQueriesPage() {
  const { queries } = useAdminData();
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const filtered = queries.filter(
    (query) =>
      !q ||
      `${query.subject} ${query.userName} ${query.message}`
        .toLowerCase()
        .includes(q),
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search queries..."
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-primary"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = filtered.filter((query) => query.status === col.status);
          return (
            <div key={col.status} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-black text-slate-800">
                  {col.label}
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                  {items.length}
                </span>
              </div>
              <div className="space-y-3">
                {items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-muted-foreground">
                    No queries here
                  </p>
                ) : (
                  items.map((query) => (
                    <QueryCard key={query.id} query={query} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
