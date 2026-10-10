"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@myhoodora/ui/input";
import { PasswordInput } from "@myhoodora/ui/password-input";
import { Button } from "@myhoodora/ui/button";
import { Divider } from "@myhoodora/ui/divider";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";
import { signUpUser } from "@/lib/firebase/auth";
import { ROUTES } from "@/lib/routes";
import { requireServerSession } from "@/lib/auth/session-sync";
import { enterApp } from "@/lib/safe-redirect";
import { getAuthErrorMessage } from "@/lib/firebase/errors";
import { GoogleOneTap } from "@/components/shared/google-one-tap";
import { SocialAuthButtons } from "@/components/shared/social-auth-buttons";
import { useRedirectIfSignedIn } from "@/hooks/use-redirect-if-signed-in";
import { toast } from "sonner";

export default function RegisterPage() {
  // Blocks a second sign-up from a fast double submit (see login page).
  const submittingRef = useRef(false);
  useRedirectIfSignedIn();

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
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const user = await signUpUser(data.email, data.password);
      // Onboarding is behind the proxy: the server session has to exist first.
      await requireServerSession(user);
      // A brand-new account always starts onboarding. The onboarding page
      // waits for the profile (created by GET /users/me) and shows an error
      // with Retry if that fails.
      enterApp(ROUTES.onboarding);
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

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Sign up
        </h1>
        <p className="text-sm text-muted-foreground">
          Join your local community to connect with neighbours.
        </p>
      </div>

      <SocialAuthButtons />
      <GoogleOneTap />

      <Divider label="or" className="py-1" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="register-email" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
            Email Address
          </label>
          <Input
            id="register-email"
            autoComplete="email"
            type="email"
            placeholder="name@example.com"
            error={errors.email?.message}
            {...register("email")}
          />
        </div>

        <div>
          <label htmlFor="register-password" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
            Password
          </label>
          <PasswordInput
            id="register-password"
            autoComplete="new-password"
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
              <Link href="/terms" target="_blank" className="underline hover:text-primary transition-all font-semibold">Terms of Use</Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="underline hover:text-primary transition-all font-semibold"
              >
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
