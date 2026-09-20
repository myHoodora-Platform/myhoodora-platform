"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@myhoodora/ui/input";
import { Button } from "@myhoodora/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validation/auth";
import { resetUserPassword } from "@/lib/firebase/auth";
import { getAuthErrorMessage } from "@/lib/firebase/errors";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setSuccessMessage(null);
    try {
      await resetUserPassword(data.email);
      setSuccessMessage(
        "If an account exists, we've sent a password reset link to your email address.",
      );
    } catch (err: unknown) {
      const { code, message, silent } = getAuthErrorMessage(err);
      if (code === "auth/user-not-found" || code === "auth/user-disabled") {
        setSuccessMessage(
          "If an account exists, we've sent a password reset link to your email address.",
        );
      } else {
        if (!silent) {
          toast.error(message);
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline uppercase tracking-wider mb-2"
        >
          <ArrowLeft className="size-4" />
          Back to Log in
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Reset password
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your email address and we&apos;ll send you a recovery link to
          get back into your account.
        </p>
      </div>

      {successMessage ? (
        <div className="p-5 bg-teal-50 border border-teal-100 text-teal-800 text-sm rounded-2xl space-y-4 animate-in fade-in duration-300">
          <div className="flex gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              className="size-5 text-primary shrink-0 stroke-primary"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
            <p className="font-semibold">{successMessage}</p>
          </div>
          <Link href="/login" className="block">
            <Button variant="outline" className="w-full">
              Go to Login page
            </Button>
          </Link>
        </div>
      ) : (
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

          <Button type="submit" className="w-full mt-2" loading={isSubmitting}>
            Send reset email
          </Button>
        </form>
      )}
    </div>
  );
}
