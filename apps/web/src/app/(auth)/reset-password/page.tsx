"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PasswordInput } from "@myhoodora/ui/password-input";
import { Button } from "@myhoodora/ui/button";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validation/auth";
import { getAuthErrorMessage } from "@/lib/firebase/errors";
import { toast } from "sonner";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");

  const [email, setEmail] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(true);
  const [verificationError, setVerificationError] = useState<string | null>(
    null,
  );
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setVerificationError(
        "Missing or invalid action code. Please request a new link.",
      );
      setVerifying(false);
      return;
    }

    verifyPasswordResetCode(auth, oobCode)
      .then((emailAddress) => {
        setEmail(emailAddress);
        setVerifying(false);
      })
      .catch((err) => {
        const { message } = getAuthErrorMessage(err);
        setVerificationError(message || "Invalid or expired action code.");
        setVerifying(false);
      });
  }, [oobCode]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordInput) => {
    if (!oobCode) return;
    try {
      await confirmPasswordReset(auth, oobCode, data.password);
      setSuccess(true);
      toast.success("Password has been reset successfully!");
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/login");
      }, 3000);
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

  if (verifying) {
    return (
      <div className="space-y-4 text-center py-6">
        <div className="text-sm text-muted-foreground animate-pulse">
          Verifying reset code...
        </div>
      </div>
    );
  }

  if (verificationError) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Reset failed
          </h1>
          <p className="text-sm text-red-600 font-medium">
            {verificationError}
          </p>
        </div>
        <Link href="/forgot-password" className="block">
          <Button variant="outline" className="w-full">
            Request a new reset link
          </Button>
        </Link>
      </div>
    );
  }

  if (success) {
    return (
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
          <div>
            <p className="font-semibold">Password reset complete</p>
            <p className="text-xs text-teal-600 mt-1">
              Your password has been updated. Redirecting you to the login
              page...
            </p>
          </div>
        </div>
        <Link href="/login" className="block">
          <Button className="w-full">Go to Login page</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Set new password
        </h1>
        <p className="text-sm text-muted-foreground">
          Resetting password for{" "}
          <span className="font-semibold text-foreground">{email}</span>.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
            New Password
          </label>
          <PasswordInput
            placeholder="••••••••"
            error={errors.password?.message}
            {...register("password")}
          />
        </div>

        <Button type="submit" className="w-full mt-2" loading={isSubmitting}>
          Reset password
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-muted-foreground animate-pulse text-center py-6">
          Loading reset form...
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
