"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api/client";
import { getPreferences, updatePreferences, type Preferences } from "@/lib/api/settings";

/** Load preferences and save each change immediately (optimistic, rolled back on failure). */
export function usePreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getPreferences(user)
      .then(setPrefs)
      .catch((err) => setError(errorMessage(err, "Couldn't load your settings.")));
  }, [user]);

  const change = async (next: Preferences) => {
    if (!user || !prefs) return;
    const previous = prefs;
    setPrefs(next);
    try {
      setPrefs(await updatePreferences(user, next));
      toast.success("Saved.", { id: "prefs-saved", duration: 1500 });
    } catch (err) {
      setPrefs(previous);
      toast.error(errorMessage(err, "Couldn't save that change."));
    }
  };

  return { prefs, error, change };
}
