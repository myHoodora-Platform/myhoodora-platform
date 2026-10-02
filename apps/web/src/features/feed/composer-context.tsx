"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ResponsiveModal } from "@/components/shared/responsive-modal";
import { useAuth } from "@/context/AuthContext";
import { ROUTES } from "@/lib/routes";
import type { PostCategory } from "@/lib/api/types";
import { PostComposer } from "./components/post-composer";

interface ComposerContextValue {
  /** Opens the composer (category picker first unless one is given). */
  openComposer: (category?: PostCategory) => void;
}

const ComposerContext = createContext<ComposerContextValue | undefined>(undefined);

/** One composer for the whole app: sidebar Post button, mobile tab, feed prompt. */
export function ComposerProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { runGatedAction } = useAuth();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<PostCategory | undefined>();
  // Remount the form on every open so it never shows a stale draft/step.
  const [session, setSession] = useState(0);

  const openComposer = useCallback(
    (initial?: PostCategory) => {
      runGatedAction(() => {
        if (initial === "for_sale") {
          router.push(`${ROUTES.forSale}?sell=1`);
          return;
        }
        setCategory(initial);
        setSession((s) => s + 1);
        setOpen(true);
      });
    },
    [runGatedAction, router],
  );

  return (
    <ComposerContext.Provider value={{ openComposer }}>
      {children}
      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        title="Post to your neighbourhood"
        description="Visible to verified neighbours in your neighbourhood."
        className="sm:max-w-xl"
      >
        <PostComposer
          key={session}
          initialCategory={category}
          onCancel={() => setOpen(false)}
          onSell={() => {
            setOpen(false);
            router.push(`${ROUTES.forSale}?sell=1`);
          }}
          onDone={(post) => {
            setOpen(false);
            if (pathname !== ROUTES.newsFeed) router.push(ROUTES.post(post._id));
          }}
        />
      </ResponsiveModal>
    </ComposerContext.Provider>
  );
}

export function useComposer() {
  const context = useContext(ComposerContext);
  if (!context) throw new Error("useComposer must be used within a ComposerProvider");
  return context;
}
