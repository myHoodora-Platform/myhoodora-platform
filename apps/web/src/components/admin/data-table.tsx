"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Checkbox } from "@myhoodora/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@myhoodora/ui/dropdown-menu";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { cn } from "@myhoodora/ui/utils";
import type { Page } from "@/lib/api/admin/types";
import { AdminProblem } from "./admin-states";

export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
  /** Show this column's value as a line in the mobile card too. */
  mobile?: boolean;
}

export interface RowAction<T> {
  label: string;
  onSelect: (row: T) => void;
  destructive?: boolean;
  hidden?: (row: T) => boolean;
}

interface DataTableProps<T> {
  page: Page<T> | null;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  rowKey: (row: T) => string;
  columns: Column<T>[];
  /** Primary cell for mobile cards (title + subtitle). */
  primary: (row: T) => React.ReactNode;
  rowHref?: (row: T) => string;
  actions?: RowAction<T>[];
  selection?: { selected: Set<string>; onChange: (next: Set<string>) => void };
  empty: React.ReactNode;
  onPage?: (page: number) => void;
  refreshing?: boolean;
}

/**
 * The one admin table: dense rows on desktop, readable cards on phones,
 * row → detail page, secondary actions behind "⋯", optional selection.
 */
export function DataTable<T>({
  page,
  loading,
  error,
  onRetry,
  rowKey,
  columns,
  primary,
  rowHref,
  actions,
  selection,
  empty,
  onPage,
  refreshing,
}: DataTableProps<T>) {
  if (loading && !page) return <TableSkeleton />;
  if (error && !page) return <AdminProblem error={error} onRetry={onRetry} />;
  if (!page || page.items.length === 0) return <div className="rounded-2xl border border-dashed border-border bg-card">{empty}</div>;

  const rows = page.items;
  const allSelected = selection && rows.every((r) => selection.selected.has(rowKey(r)));
  const toggleAll = () => {
    if (!selection) return;
    const next = new Set(selection.selected);
    rows.forEach((r) => (allSelected ? next.delete(rowKey(r)) : next.add(rowKey(r))));
    selection.onChange(next);
  };
  const toggle = (id: string) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selection.onChange(next);
  };

  return (
    <div className={cn("space-y-3 transition-opacity", refreshing && "opacity-60")}>
      {/* Desktop */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {selection && (
                <th className="w-10 px-4 py-3">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all on this page" />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.header} className={cn("px-4 py-3 font-semibold", c.className)}>
                  {c.header}
                </th>
              ))}
              {actions && <th className="w-12 px-2 py-3"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = rowKey(row);
              const href = rowHref?.(row);
              return (
                <tr key={id} className={cn("group border-b border-border last:border-0 hover:bg-muted/30", selection?.selected.has(id) && "bg-primary/5")}>
                  {selection && (
                    <td className="px-4 py-3">
                      <Checkbox checked={selection.selected.has(id)} onCheckedChange={() => toggle(id)} aria-label="Select row" />
                    </td>
                  )}
                  {columns.map((c, i) => (
                    <td key={c.header} className={cn("px-4 py-3 align-middle", c.className)}>
                      {i === 0 && href ? (
                        <Link href={href} className="block font-semibold hover:text-primary hover:underline">
                          {c.cell(row)}
                        </Link>
                      ) : (
                        c.cell(row)
                      )}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-2 py-3 text-right">
                      <RowMenu row={row} actions={actions} href={href} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => {
          const id = rowKey(row);
          const href = rowHref?.(row);
          const body = (
            <>
              <div className="min-w-0 flex-1">{primary(row)}</div>
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {columns
                  .filter((c) => c.mobile)
                  .map((c) => (
                    <div key={c.header} className="flex items-center gap-1">
                      <dt className="sr-only">{c.header}</dt>
                      <dd>{c.cell(row)}</dd>
                    </div>
                  ))}
              </dl>
            </>
          );
          return (
            <li key={id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
              {selection && <Checkbox checked={selection.selected.has(id)} onCheckedChange={() => toggle(id)} aria-label="Select" className="mt-1" />}
              {href ? (
                <Link href={href} className="min-w-0 flex-1">
                  {body}
                </Link>
              ) : (
                <div className="min-w-0 flex-1">{body}</div>
              )}
              {actions && <RowMenu row={row} actions={actions} />}
            </li>
          );
        })}
      </ul>

      {onPage && <Pager page={page} onPage={onPage} />}
    </div>
  );
}

function RowMenu<T>({ row, actions, href }: { row: T; actions: RowAction<T>[]; href?: string }) {
  const visible = actions.filter((a) => !a.hidden?.(row));
  if (!visible.length && !href) return null;
  const safe = visible.filter((a) => !a.destructive);
  const danger = visible.filter((a) => a.destructive);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="More actions"
        className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {href && (
          <DropdownMenuItem asChild>
            <Link href={href}>View details</Link>
          </DropdownMenuItem>
        )}
        {safe.map((a) => (
          <DropdownMenuItem key={a.label} onSelect={() => a.onSelect(row)}>
            {a.label}
          </DropdownMenuItem>
        ))}
        {danger.length > 0 && <DropdownMenuSeparator />}
        {danger.map((a) => (
          <DropdownMenuItem key={a.label} onSelect={() => a.onSelect(row)} className="text-destructive focus:text-destructive">
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Pager<T>({ page, onPage }: { page: Page<T>; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(page.total / page.pageSize));
  if (pages <= 1) return null;
  const from = (page.page - 1) * page.pageSize + 1;
  const to = Math.min(page.total, page.page * page.pageSize);
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">
        {from}–{to} of {page.total}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page.page <= 1}
          onClick={() => onPage(page.page - 1)}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 font-semibold disabled:opacity-40"
        >
          <ChevronLeft className="size-4" aria-hidden /> Prev
        </button>
        <button
          type="button"
          disabled={page.page >= pages}
          onClick={() => onPage(page.page + 1)}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3 font-semibold disabled:opacity-40"
        >
          Next <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card p-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function countLabel(page: Page<unknown> | null, noun: string) {
  if (!page) return undefined;
  return `${page.total} ${noun}${page.total === 1 ? "" : "s"}`;
}
