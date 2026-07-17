"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@myhoodora/ui/input";
import { PasswordInput } from "@myhoodora/ui/password-input";
import { Button } from "@myhoodora/ui/button";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";
import { signUpUser, signInWithGoogle, signInWithApple } from "@/lib/firebase/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      agreeToTerms: false,
    },
  });

  const onSubmit = async (data: RegisterInput) => {
    setAuthError(null);
    try {
      await signUpUser(data.email, data.password);
      // New registration redirects to onboarding
      router.push("/onboarding");
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setAuthError(message || "Failed to create an account.");
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // Assume Google sign-in is new or existing.
      // Usually Google signup redirects to onboarding if new.
      // For this phase, we redirect to onboarding as a default for signup path.
      router.push("/onboarding");
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setAuthError(message || "Google sign-in failed.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAuthError(null);
    setAppleLoading(true);
    try {
      await signInWithApple();
      router.push("/onboarding");
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setAuthError(message || "Apple sign-in failed.");
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-black tracking-tight text-foreground">Sign up</h1>
        <p className="text-sm text-muted-foreground">
          Join your local community to connect with neighbors.
        </p>
      </div>

      {authError && (
        <div className="p-4 bg-destructive/10 text-destructive text-sm font-semibold rounded-xl flex items-center gap-2 animate-in fade-in duration-200">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            className="size-5 shrink-0"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
          <span>{authError}</span>
        </div>
      )}

      <div className="space-y-3">
        <Button
          variant="outline"
          className="w-full gap-3"
          onClick={handleGoogleSignIn}
          loading={googleLoading}
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
          onClick={handleAppleSignIn}
          loading={appleLoading}
        >
          <svg className="size-5 fill-current" viewBox="0 0 24 24">
            <path d="M17.05 20.28c-.96 0-2.04-.6-3.23-.6-1.16 0-2.22.56-3.12.56-1.44 0-4.39-2.86-4.39-7.07 0-4.23 2.72-6.44 5.33-6.44 1.38 0 2.51.88 3.51.88 1 0 2.44-.94 3.97-.94 1.83 0 3.32.96 4.14 2.21-3.66 1.54-3.08 6.42.54 7.9-1.07 2.76-2.3 3.5-3.15 3.5zm-1.63-14.71c-.81 1.01-2.12 1.67-3.26 1.58-.16-1.18.42-2.49 1.29-3.41.9-.96 2.25-1.55 3.25-1.55.19 1.25-.47 2.37-1.28 3.38z" />
          </svg>
          Continue with Apple
        </Button>
      </div>

      <div className="flex items-center gap-4 py-1">
        <div className="h-px flex-1 bg-border"></div>
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">or</span>
        <div className="h-px flex-1 bg-border"></div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
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
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            Password
          </label>
          <PasswordInput
            placeholder="••••••••"
            error={errors.password?.message}
            {...register("password")}
          />
        </div>

        <div className="flex flex-col gap-1 px-1 pt-1">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-1 rounded border-gray-300 text-primary focus:ring-primary size-4 shrink-0"
              {...register("agreeToTerms")}
            />
            <span className="text-xs text-muted-foreground leading-normal">
              I agree to myHoodora&apos;s{" "}
              <Link href="/terms" className="underline hover:text-primary transition-all font-semibold">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline hover:text-primary transition-all font-semibold">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {errors.agreeToTerms && (
            <span className="text-xs text-destructive font-semibold px-1 animate-in fade-in duration-200">
              {errors.agreeToTerms.message}
            </span>
          )}
        </div>

        <Button type="submit" className="w-full mt-2" loading={isSubmitting}>
          Continue
        </Button>
      </form>
    </div>
  );
}
