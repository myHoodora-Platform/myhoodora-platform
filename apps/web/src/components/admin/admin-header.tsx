"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger, useSidebar } from "@myhoodora/ui/sidebar";
import { Search } from "lucide-react";
import { useAdminData } from "@/context/AdminDataContext";

interface AdminHeaderProps {
  /** Page title shown on the left, next to the sidebar trigger. */
  title: string;
}

export function AdminHeader({ title }: AdminHeaderProps) {
  const router = useRouter();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { users } = useAdminData();
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  const trimmed = query.trim().toLowerCase();
  const results = trimmed
    ? users
        .filter((u) =>
          `${u.displayName} ${u.email}`.toLowerCase().includes(trimmed),
        )
        .slice(0, 5)
    : [];

  const goToUser = (uid: string) => {
    router.push(`/admin/users?uid=${uid}`);
    setQuery("");
    setShowResults(false);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/60 bg-white/80 px-4 backdrop-blur-md sm:px-6">
      <SidebarTrigger className="lg:hidden" />
      {isCollapsed && <SidebarTrigger className="hidden lg:inline-flex" />}

      <h1 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">
        {title}
      </h1>

      <div className="relative ml-auto hidden max-w-xs flex-1 sm:block">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 150)}
          placeholder="Search users..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:bg-white"
        />
        {showResults && results.length > 0 && (
          <div className="absolute top-full mt-1.5 w-full rounded-xl border border-slate-100 bg-white p-1.5 shadow-xl">
            {results.map((u) => (
              <button
                key={u.uid}
                type="button"
                onClick={() => goToUser(u.uid)}
                className="flex w-full flex-col items-start rounded-lg px-2.5 py-2 text-left hover:bg-slate-50"
              >
                <span className="truncate text-sm font-semibold text-slate-800">
                  {u.displayName}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {u.email}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
