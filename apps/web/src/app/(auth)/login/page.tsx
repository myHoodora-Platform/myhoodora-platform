"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@myhoodora/ui/input";
import { PasswordInput } from "@myhoodora/ui/password-input";
import { Button } from "@myhoodora/ui/button";
import { Divider } from "@myhoodora/ui/divider";
import { enterApp, safeNextPath } from "@/lib/safe-redirect";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import {
  signInUser,
  signInWithGoogle,
  signInWithApple,
  routeAfterSignIn,
} from "@/lib/firebase/auth";
import { getAuthErrorMessage } from "@/lib/firebase/errors";
import { SocialAuthButtons } from "@/components/shared/social-auth-buttons";
import { useRedirectIfSignedIn } from "@/hooks/use-redirect-if-signed-in";
import { toast } from "sonner";

// Read at click time (not via useSearchParams) so this page stays statically rendered.
const nextPath = () =>
  safeNextPath(new URLSearchParams(window.location.search).get("next"));

export default function LoginPage() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  // isSubmitting only disables the button after a re-render, so a fast
  // Enter + click could start two sign-ins; this blocks the second at once.
  const submittingRef = useRef(false);
  useRedirectIfSignedIn();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const user = await signInUser(data.email, data.password);
      enterApp(await routeAfterSignIn(user, nextPath()));
    } catch (err: unknown) {
      const { code, message, silent } = getAuthErrorMessage(err);
      if (process.env.NODE_ENV === "development" && code) {
        console.warn(`[AuthError code]: ${code}`);
      }
      if (!silent) {
        toast.error(message);
      }
    } finally {
      submittingRef.current = false;
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const user = await signInWithGoogle();
      enterApp(await routeAfterSignIn(user, nextPath()));
    } catch (err: unknown) {
      const { code, message, silent } = getAuthErrorMessage(err);
      if (process.env.NODE_ENV === "development" && code) {
        console.warn(`[AuthError code]: ${code}`);
      }
      if (!silent) {
        toast.error(message);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    try {
      const user = await signInWithApple();
      enterApp(await routeAfterSignIn(user, nextPath()));
    } catch (err: unknown) {
      const { code, message, silent } = getAuthErrorMessage(err);
      if (process.env.NODE_ENV === "development" && code) {
        console.warn(`[AuthError code]: ${code}`);
      }
      if (!silent) {
        toast.error(message);
      }
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Log in
        </h1>
        <p className="text-sm text-muted-foreground">
          Welcome back! Log in to connect with your community.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
            Email Address
          </label>
          <Input
            type="email"
            placeholder="name@example.com"
            error={errors.email?.message}
            {...register("email")}
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2 px-1">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-primary hover:underline transition-all"
            >
              Forgot my password
            </Link>
          </div>
          <PasswordInput
            placeholder="••••••••"
            error={errors.password?.message}
            {...register("password")}
          />
        </div>

        <Button type="submit" className="w-full mt-2" loading={isSubmitting}>
          Log in
        </Button>
      </form>

      <Divider label="or" className="py-1" />

      <SocialAuthButtons
        onGoogleClick={handleGoogleSignIn}
        onAppleClick={handleAppleSignIn}
        googleLoading={googleLoading}
        appleLoading={appleLoading}
      />
    </div>
  );
}
