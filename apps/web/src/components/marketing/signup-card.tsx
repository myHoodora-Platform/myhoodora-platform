"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { Divider } from "@myhoodora/ui/divider";
import { Input } from "@myhoodora/ui/input";
import { MascotLockup } from "@myhoodora/ui/logo";
import { PasswordInput } from "@myhoodora/ui/password-input";
import { cn } from "@myhoodora/ui/utils";
import { SocialAuthButtons } from "@/components/shared/social-auth-buttons";
import { signUpUser } from "@/lib/firebase/auth";
import { getAuthErrorMessage } from "@/lib/firebase/errors";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";
import { ROUTES } from "@/lib/routes";
import { requireServerSession } from "@/lib/auth/session-sync";
import { enterApp } from "@/lib/safe-redirect";

function reportAuthError(err: unknown) {
  const { code, message, silent } = getAuthErrorMessage(err);
  if (process.env.NODE_ENV === "development" && code) console.warn(`[AuthError code]: ${code}`);
  if (!silent) toast.error(message);
}

/**
 * Landing-hero sign-up card (Nextdoor-style: join right from the homepage).
 * Frosted glass over the hero photo; email sign-up expands in place.
 */
export function SignupCard({ className }: { className?: string }) {
  const [emailMode, setEmailMode] = useState(false);
  // Blocks a second sign-up from a fast double submit.
  const submittingRef = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { agreeToTerms: false },
  });

  const onSubmit = async (data: RegisterInput) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      const user = await signUpUser(data.email, data.password);
      // Onboarding is behind the proxy: the server session has to exist first.
      await requireServerSession(user);
      enterApp(ROUTES.onboarding);
    } catch (err) {
      reportAuthError(err);
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <div
      className={cn(
        "w-full rounded-3xl border border-white/60 bg-white/90 p-7 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-8",
        className,
      )}
    >
      {emailMode ? (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setEmailMode(false)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden /> Back
          </button>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight">Sign up with email</h2>
            <p className="text-sm text-muted-foreground">It only takes a minute. Then we&apos;ll find your neighbourhood.</p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label htmlFor="hero-email" className="mb-1.5 block text-sm font-semibold">
                Email address
              </label>
              <Input id="hero-email" type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register("email")} />
            </div>
            <div>
              <label htmlFor="hero-password" className="mb-1.5 block text-sm font-semibold">
                Password
              </label>
              <PasswordInput id="hero-password" autoComplete="new-password" placeholder="At least 8 characters" error={errors.password?.message} {...register("password")} />
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 select-none">
              <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]" {...register("agreeToTerms")} />
              <span className="text-xs leading-normal text-muted-foreground">
                I agree to the{" "}
                <Link href="/terms" target="_blank" className="font-semibold underline hover:text-primary">
                  Terms of Use
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" className="font-semibold underline hover:text-primary">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            {errors.agreeToTerms && <p className="text-xs font-semibold text-destructive">{errors.agreeToTerms.message}</p>}
            <Button type="submit" size="lg" className="w-full rounded-full" loading={isSubmitting}>
              Create my account
            </Button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            <MascotLockup size="sm" />
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">Join your neighbours</h2>
              <p className="text-sm text-muted-foreground">Free for residents. Takes about a minute.</p>
            </div>
          </div>
          <div className="space-y-3">
            <SocialAuthButtons />
            <Divider label="or" className="py-1" />
            <Button size="lg" className="w-full rounded-full" onClick={() => setEmailMode(true)}>
              <Mail className="size-4" aria-hidden /> Sign up with email
            </Button>
          </div>
          <div className="space-y-3 text-center text-sm">
            <p className="text-muted-foreground">
              Already a member?{" "}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Log in
              </Link>
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              By signing up you agree to our{" "}
              <Link href="/terms" className="underline hover:text-primary">
                Terms of Use
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline hover:text-primary">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
