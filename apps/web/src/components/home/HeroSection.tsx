"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatedSection } from "@/components/shared/AnimatedSection";
import { MapPin, ArrowLeft } from "lucide-react";
import { Button } from "@myhoodora/ui/button";
import { Divider } from "@myhoodora/ui/divider";
import { Input } from "@myhoodora/ui/input";
import { SmartImage } from "@myhoodora/ui/image";
import { MascotMark } from "@myhoodora/ui/logo";
import { PasswordInput } from "@myhoodora/ui/password-input";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";
import {
  signUpUser,
  signInWithGoogle,
  signInWithApple,
} from "@/lib/firebase/auth";
import { getAuthErrorMessage } from "@/lib/firebase/errors";
import { SocialAuthButtons } from "@/components/shared/social-auth-buttons";
import { toast } from "sonner";
import { HERO_IMAGE } from "@/lib/site-images";

export function HeroSection() {
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
    <section className="relative min-h-[85vh] flex items-center justify-center px-6 lg:px-20 py-12 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <SmartImage
          fill
          priority
          className="object-cover"
          alt={HERO_IMAGE.alt}
          src={HERO_IMAGE.src}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/60 to-transparent"></div>
        <a
          href={HERO_IMAGE.creditUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 right-4 z-10 rounded-md bg-black/25 px-2 py-0.5 text-[11px] text-white/60 backdrop-blur-sm transition-colors hover:text-white/90"
        >
          Photo: {HERO_IMAGE.credit}
        </a>
      </div>

      <div className="relative z-10 max-w-7xl w-full grid lg:grid-cols-2 gap-12 items-center">
        <AnimatedSection
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="space-y-6"
        >
          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight leading-tight text-foreground">
            Discover your <br />
            <span className="text-primary">neighborhood</span>
          </h1>
          <p className="text-lg lg:text-xl text-muted-foreground max-w-lg leading-relaxed">
            Join your local community to connect with neighbors, stay informed
            with real-time alerts, and build a safer, friendlier place to live.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 max-w-md pt-4">
            <div className="flex-1 relative group">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors size-5" />
              <Input
                className="pl-12 pr-4"
                placeholder="Enter your address"
                type="text"
              />
            </div>
            <Button size="lg" className="whitespace-nowrap">
              Find my hood
            </Button>
          </div>
        </AnimatedSection>

        <AnimatedSection
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white/95 backdrop-blur-sm p-8 rounded-3xl shadow-2xl border border-border max-w-md w-full ml-auto"
        >
          {showEmailRegister ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setShowEmailRegister(false);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline uppercase tracking-wider mb-2 outline-none"
                >
                  <ArrowLeft className="size-4" />
                  Back
                </button>
                <h3 className="text-2xl font-bold">Sign up with Email</h3>
                <p className="text-muted-foreground text-sm">
                  Enter your credentials to join your local neighborhood.
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

                <Button
                  type="submit"
                  className="w-full mt-2"
                  loading={isSubmitting}
                >
                  Continue
                </Button>
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <MascotMark size="lg" className="mb-4" />
                <h3 className="text-2xl font-bold mb-2">
                  Welcome to myHoodora
                </h3>
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

                <Button
                  className="w-full"
                  onClick={() => {
                    setShowEmailRegister(true);
                  }}
                >
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
        </AnimatedSection>
      </div>
    </section>
  );
}
