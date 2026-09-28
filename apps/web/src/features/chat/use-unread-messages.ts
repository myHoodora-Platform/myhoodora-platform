"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useMockChanges } from "@/hooks/use-mock-changes";
import { unreadTotal } from "@/lib/api/chat";

/** Unread message count for the header/tab badge. */
export function useUnreadMessages(): number {
  const { user } = useAuth();
  const version = useMockChanges("chat:");
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (user) setCount(unreadTotal(user.uid));
  }, [user, version]);

  return count;
}
