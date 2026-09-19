"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@myhoodora/ui/button";
import { Divider } from "@myhoodora/ui/divider";
import { Input } from "@myhoodora/ui/input";
import { MascotMark } from "@myhoodora/ui/logo";
import { PasswordInput } from "@myhoodora/ui/password-input";
import { cn } from "@myhoodora/ui/utils";
import { SocialAuthButtons } from "@/components/shared/social-auth-buttons";
import {
  signUpUser,
  signInWithGoogle,
  signInWithApple,
} from "@/lib/firebase/auth";
import { getAuthErrorMessage } from "@/lib/firebase/errors";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";

interface HeroAuthCardProps {
  className?: string;
}

/**
 * Sign-up / sign-in panel shown in the landing hero. Owns all of its auth
 * state and handlers so the hero layout stays focused on composition.
 */
export function HeroAuthCard({ className }: HeroAuthCardProps) {
  const router = useRouter();
  const [showEmailRegister, setShowEmailRegister] = useState(false);
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
    try {
      await signUpUser(data.email, data.password);
      router.push("/onboarding");
    } catch (err: unknown) {
      const { code, message, silent } = getAuthErrorMessage(err);
      if (process.env.NODE_ENV === "development" && code) {
        console.warn(`[AuthError code]: ${code}`);
      }
      if (!silent) {
        toast.error(message);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.push("/onboarding");
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
      await signInWithApple();
      router.push("/onboarding");
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
    <div
      className={cn(
        "w-full rounded-3xl border border-border bg-white/95 p-8 shadow-lg backdrop-blur-sm",
        className,
      )}
    >
      {showEmailRegister ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <button
              onClick={() => setShowEmailRegister(false)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline uppercase tracking-wider mb-2 outline-none"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
            <h3 className="text-2xl font-semibold">Sign up with Email</h3>
            <p className="text-muted-foreground text-sm">
              Enter your credentials to join your local neighbourhood.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
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
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
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
                  <Link
                    href="/terms"
                    className="underline hover:text-primary transition-all font-semibold"
                  >
                    Terms of Service
                  </Link>{" "}
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
      ) : (
        <div className="space-y-6">
          <div>
            <MascotMark size="lg" className="mb-4" />
            <h3 className="text-2xl font-semibold mb-2">Welcome to myHoodora</h3>
            <p className="text-muted-foreground text-sm">
              Choose how you&apos;d like to join your community.
            </p>
          </div>

          <div className="space-y-3">
            <SocialAuthButtons
              onGoogleClick={handleGoogleSignIn}
              onAppleClick={handleAppleSignIn}
              googleLoading={googleLoading}
              appleLoading={appleLoading}
            />

            <Divider label="or" className="py-2" />

            <Button className="w-full" onClick={() => setShowEmailRegister(true)}>
              Sign up with Email
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground leading-relaxed">
            By signing up, you agree to our{" "}
            <Link
              className="underline hover:text-primary transition-colors"
              href="/terms"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              className="underline hover:text-primary transition-colors"
              href="/privacy"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
