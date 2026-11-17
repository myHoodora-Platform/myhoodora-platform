import type { SeasonMascot } from "@myhoodora/api-contract/seasons";
import { cn } from "@myhoodora/ui/utils";

/** The app-icon character with a Santa hat or a party hat on (drawn here, so no licence strings). */
export function FestiveMascot({
  hat,
  className,
}: {
  hat: SeasonMascot;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-block shrink-0", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a small local icon */}
      <img
        src="/logo/app-icon.png"
        alt=""
        className="size-full rounded-full bg-white object-cover ring-1 ring-border"
      />
      {hat === "santa_hat" && (
        <svg
          viewBox="0 0 64 48"
          aria-hidden
          className="absolute -top-[30%] left-[22%] w-[62%] -rotate-12 drop-shadow-sm"
        >
          <path
            d="M8 40 C14 18 30 6 48 10 C54 12 58 20 56 28 L50 26 C48 20 44 18 40 20 C30 24 24 32 22 40 Z"
            fill="#d32f2f"
          />
          <rect x="4" y="36" width="34" height="10" rx="5" fill="#fff" />
          <circle cx="54" cy="30" r="6" fill="#fff" />
        </svg>
      )}
      {hat === "party_hat" && (
        <svg
          viewBox="0 0 48 56"
          aria-hidden
          className="absolute -top-[36%] left-[30%] w-[40%] rotate-12 drop-shadow-sm"
        >
          <path d="M24 4 L44 50 L4 50 Z" fill="#fbc02d" />
          <path
            d="M24 4 L30 18 L18 18 Z M14 30 L34 30 L37 38 L11 38 Z"
            fill="#ab47bc"
          />
          <circle cx="24" cy="5" r="5" fill="#29b6f6" />
          <rect x="2" y="48" width="44" height="6" rx="3" fill="#ff7043" />
        </svg>
      )}
    </span>
  );
}
