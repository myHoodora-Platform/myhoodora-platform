"use client";

import { useEffect, useState } from "react";

/**
 * Re-render counter bumped whenever the preview mock store changes (e.g. a
 * message is sent or a notification read), so badges stay in sync across
 * components without a global state library.
 */
export function useMockChanges(prefix?: string): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const onChange = (e: Event) => {
      const key = (e as CustomEvent<string>).detail;
      if (!prefix || key.startsWith(prefix)) setVersion((v) => v + 1);
    };
    window.addEventListener("mh-mock-change", onChange);
    return () => window.removeEventListener("mh-mock-change", onChange);
  }, [prefix]);
  return version;
}
