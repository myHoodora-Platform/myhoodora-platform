"use client";

import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@myhoodora/ui/input";
import { PasswordInput } from "@myhoodora/ui/password-input";
import { Button } from "@myhoodora/ui/button";
import { Divider } from "@myhoodora/ui/divider";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";
import { acceptLegalApi, confirmAgeApi, logoutUser, signUpUser } from "@/lib/firebase/auth";
import { currentLegalVersion, needsLegalAcceptance } from "@myhoodora/api-contract/legal";
import { readBirthInput } from "@myhoodora/api-contract/age";
import { ROUTES } from "@/lib/routes";
import { requireServerSession } from "@/lib/auth/session-sync";
import { enterApp } from "@/lib/safe-redirect";
import { getAuthErrorMessage } from "@/lib/firebase/errors";
import { GoogleOneTap } from "@/components/shared/google-one-tap";
import { SocialAuthButtons } from "@/components/shared/social-auth-buttons";
import { useRedirectIfSignedIn } from "@/hooks/use-redirect-if-signed-in";
import { toast } from "sonner";
import { BirthField, CantJoinYet, EMPTY_BIRTH, type BirthInput } from "@/features/age/age-check-form";
import { ageCheckLocked, lockAgeCheck } from "@/features/age/age-lock";
import { PolicyReviewDialog } from "@/components/legal/policy-review-dialog";

export default function RegisterPage() {
  // Blocks a second sign-up from a fast double submit (see login page).
  const submittingRef = useRef(false);
  useRedirectIfSignedIn();
  // Turned away by the age check on this browser recently: no new account from here for a while.
  const [locked, setLocked] = useState(false);
  useEffect(() => setLocked(ageCheckLocked()), []);
  // The age check, in the form (docs/compliance/ndpa.md §1): Google and Apple sign-ups get it on its own screen.
  const [birth, setBirth] = useState<BirthInput>(EMPTY_BIRTH);
  const [birthProblem, setBirthProblem] = useState<string | null>(null);

  const [reviewing, setReviewing] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      agreeToTerms: false,
    },
  });

  const onSubmit = async (data: RegisterInput) => {
    if (submittingRef.current) return;
    const age = readBirthInput(birth);
    if (!age.ok) {
      setBirthProblem(age.problem);
      return;
    }
    // Under 18: no account is made at all, so there's nothing of a child's to delete.
    if (!age.adult) {
      lockAgeCheck();
      setLocked(true);
      return;
    }
    submittingRef.current = true;
    try {
      const user = await signUpUser(data.email, data.password);
      // Onboarding is behind the proxy: the server session has to exist first.
      await requireServerSession(user);
      let next: string = ROUTES.onboarding;
      // They ticked "I agree" above: that's the record, with the versions they could read.
      await acceptLegalApi(user, { terms: currentLegalVersion("terms").version, privacy: currentLegalVersion("privacy").version }, "signup").catch(() => {
        // Not recorded (a network blip): the "updated terms" screen asks before onboarding.
        next = ROUTES.acceptTerms;
      });
      try {
        // The server decides (and on its own clock); it agrees with the form except across midnight.
        const result = await confirmAgeApi(user, age.value);
        if (result.adult && result.profile.legal && needsLegalAcceptance(result.profile.legal)) next = ROUTES.acceptTerms;
        if (!result.adult) {
          lockAgeCheck();
          await logoutUser();
          setLocked(true);
          return;
        }
      } catch {
        // Not recorded (a network blip): the age check screen asks again before onboarding.
        next = ROUTES.confirmAge;
      }
      enterApp(next);
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

  if (locked) return <CantJoinYet />;

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

      <form
        onSubmit={(e) => {
          // Shown with the other fields' errors, not only once they pass.
          const age = readBirthInput(birth);
          if (!age.ok) setBirthProblem(age.problem);
          void handleSubmit(onSubmit)(e);
        }}
        className="space-y-4"
      >
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

        <BirthField
          idPrefix="register-dob"
          value={birth}
          onChange={(next) => {
            setBirth(next);
            setBirthProblem(null);
          }}
          problem={birthProblem}
        />

        <div className="flex flex-col gap-1 px-1 pt-1">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            {/* Ticked only by "I agree" after reading both to the end (PolicyReviewDialog); unticking is direct. */}
            <input
              type="checkbox"
              className="mt-1 rounded border-gray-300 text-primary focus:ring-primary size-4 shrink-0"
              {...register("agreeToTerms")}
              onChange={(e) => {
                if (e.target.checked) {
                  e.preventDefault();
                  setReviewing(true);
                } else setValue("agreeToTerms", false, { shouldValidate: true });
              }}
              checked={watch("agreeToTerms")}
            />
            <span className="text-xs text-muted-foreground leading-normal">
              I agree to myHoodora&apos;s{" "}
              <button type="button" onClick={() => setReviewing(true)} className="underline hover:text-primary transition-all font-semibold">
                Terms of Use
              </button>{" "}
              and{" "}
              <button type="button" onClick={() => setReviewing(true)} className="underline hover:text-primary transition-all font-semibold">
                Privacy Policy
              </button>
              .
            </span>
          </label>
          <PolicyReviewDialog
            open={reviewing}
            onOpenChange={setReviewing}
            onAgree={() => {
              setValue("agreeToTerms", true, { shouldValidate: true });
              setReviewing(false);
            }}
          />
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
