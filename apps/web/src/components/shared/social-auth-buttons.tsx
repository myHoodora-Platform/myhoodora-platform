"use client";

import { Button } from "@myhoodora/ui/button";

/**
 * Google/Apple sign-in isn't finished and tested yet (OAuth provider setup,
 * error handling, etc.) — flip this to true once it is, and every sign-in
 * and sign-up entry point re-enables at once from this one file.
 */
export const SOCIAL_AUTH_ENABLED = false;

interface SocialAuthButtonsProps {
  onGoogleClick: () => void;
  onAppleClick: () => void;
  googleLoading?: boolean;
  appleLoading?: boolean;
}

export function SocialAuthButtons({
  onGoogleClick,
  onAppleClick,
  googleLoading,
  appleLoading,
}: SocialAuthButtonsProps) {
  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        className="w-full gap-3"
        onClick={onGoogleClick}
        loading={googleLoading}
        disabled={!SOCIAL_AUTH_ENABLED}
        title={SOCIAL_AUTH_ENABLED ? undefined : "Coming soon"}
      >
        <svg className="size-5" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
            fill="#EA4335"
          />
        </svg>
        Continue with Google
      </Button>

      <Button
        variant="outline"
        className="w-full gap-3"
        onClick={onAppleClick}
        loading={appleLoading}
        disabled={!SOCIAL_AUTH_ENABLED}
        title={SOCIAL_AUTH_ENABLED ? undefined : "Coming soon"}
      >
        <svg className="size-5 fill-current" viewBox="0 0 24 24">
          <path d="M17.05 20.28c-.96 0-2.04-.6-3.23-.6-1.16 0-2.22.56-3.12.56-1.44 0-4.39-2.86-4.39-7.07 0-4.23 2.72-6.44 5.33-6.44 1.38 0 2.51.88 3.51.88 1 0 2.44-.94 3.97-.94 1.83 0 3.32.96 4.14 2.21-3.66 1.54-3.08 6.42.54 7.9-1.07 2.76-2.3 3.5-3.15 3.5zm-1.63-14.71c-.81 1.01-2.12 1.67-3.26 1.58-.16-1.18.42-2.49 1.29-3.41.9-.96 2.25-1.55 3.25-1.55.19 1.25-.47 2.37-1.28 3.38z" />
        </svg>
        Continue with Apple
      </Button>

      {!SOCIAL_AUTH_ENABLED && (
        <p className="text-center text-xs text-muted-foreground">
          Google and Apple sign-in are coming soon — use email for now.
        </p>
      )}
    </div>
  );
}
