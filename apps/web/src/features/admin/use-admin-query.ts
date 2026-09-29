"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { useAuth } from "@/context/AuthContext";

export interface AdminQuery<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  /** true while re-fetching with data already on screen */
  refreshing: boolean;
  refetch: () => Promise<void>;
  setData: (next: T) => void;
}

/**
 * Loads admin data for the signed-in user. Re-runs when `key` changes (e.g.
 * the URL filters), keeps the previous data visible while refreshing, and
 * ignores out-of-order responses.
 */
export function useAdminQuery<T>(fetcher: (user: User) => Promise<T>, key: string): AdminQuery<T> {
  const { user } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const hasData = useRef(false);

  const run = useCallback(async () => {
    if (!user) return;
    const id = ++seq.current;
    if (hasData.current) setRefreshing(true);
    else setLoading(true);
    try {
      const next = await fetcherRef.current(user);
      if (id !== seq.current) return;
      setData(next);
      hasData.current = true;
      setError(null);
    } catch (err) {
      if (id === seq.current) setError(err);
    } finally {
      if (id === seq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [user]);

  useEffect(() => {
    void run();
  }, [run, key]);

  return {
    data,
    error,
    loading,
    refreshing,
    refetch: run,
    setData: (next: T) => {
      hasData.current = true;
      setData(next);
    },
  };
}
