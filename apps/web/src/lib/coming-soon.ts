import { toast } from "sonner";

/**
 * Shared "not built yet" feedback. Anything that isn't wired up should call this
 * instead of doing nothing, so testers know the button is real but unfinished.
 * The fixed id stops repeat clicks from stacking a pile of toasts.
 */
export function showComingSoon(feature?: string) {
  toast.info(feature ? `${feature} is coming soon` : "Coming soon", {
    id: "coming-soon",
    description: "We're still building this. Check back shortly.",
  });
}
