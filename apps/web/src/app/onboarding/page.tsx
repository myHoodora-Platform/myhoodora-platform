"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useNeighbourhood } from "@/hooks/use-neighbourhood";
import { ProblemState } from "@/components/shared/connection-states";
import { ApiError } from "@/lib/api/client";
import { DEFAULT_APP_ROUTE, ROUTES } from "@/lib/routes";
import {
  clearOnboardingDraft,
  clearOnboardingSkipped,
  markOnboardingSkipped,
  readOnboardingDraft,
  saveOnboardingDraft,
} from "@/features/onboarding/draft";
import { OnboardingShell } from "@/features/onboarding/onboarding-shell";
import { ConfirmStep, DetailsStep, NearbyHoodsStep, RequestSentStep, VerifyStep } from "@/features/onboarding/steps";
import type { NearbyHood } from "@/lib/api/types";

// How long to hold checklist step 1 ("Checking address coordinates") visible
// before moving to step 2. That check is really just "do we have coordinates
// to send?" — true the instant runVerification runs — so without a small
// floor it would flip to done in the same frame as step 2, and both would
// visually tick together. Step 2 onward has no floor: each is held open for
// exactly as long as its real network call takes.
const LOCAL_CHECK_MIN_MS = 300;

// Same bounds as the API's OnboardingDto.displayName (2–60 characters).
const NAME_MIN = 2;
const NAME_MAX = 60;

function saveErrorMessage(err: unknown): string {
  // Validation errors carry the API's own explanation; everything else
  // (offline, slow, server down) already has friendly wording.
  if (err instanceof ApiError) {
    return err.kind === "client" ? `We couldn't save your details: ${err.message}` : err.message;
  }
  return "We couldn't save your details. Please try again.";
}

const isSessionError = (err: unknown) => err instanceof ApiError && err.kind === "auth";

export default function OnboardingPage() {
  const router = useRouter();
  const {
    user,
    profile,
    profileStatus,
    profileError,
    refreshProfile,
    completeOnboarding,
    verifyLocation,
    requestHood,
    loading,
  } = useAuth();
  const neighbourhood = useNeighbourhood();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [detecting, setDetecting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [verifyingStatus, setVerifyingStatus] = useState(0);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [verificationOutcome, setVerificationOutcome] = useState<
    "pending" | "success" | "unverified" | "nearby" | "error" | "requested"
  >("pending");
  // Outside every Hood but close to some: offered as "request to join".
  const [nearbyHoods, setNearbyHoods] = useState<NearbyHood[]>([]);
  const [selectedHoodId, setSelectedHoodId] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Signed out (or the session expired mid-way): back to login, then here.
  useEffect(() => {
    if (!loading && !user) {
      router.replace(`${ROUTES.login}?next=${encodeURIComponent(ROUTES.onboarding)}`);
    }
  }, [loading, user, router]);

  // Restore this account's saved draft (typed earlier, then refreshed,
  // skipped or closed), then fall back to whatever's already on the account
  // (a previous onboarding attempt — someone retrying verification
  // shouldn't have to retype their address), then the Firebase display name.
  // Runs once, when the profile is known.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || !user || profileStatus !== "ready") return;
    restoredRef.current = true;
    const draft = readOnboardingDraft(user.uid);
    if (draft?.name || draft?.address) {
      setName(draft.name);
      setAddress(draft.address);
      setCoords(draft.coords);
      if (draft.step === 2 && draft.coords) setStep(2);
    } else if (profile?.displayName || profile?.location?.address) {
      setName(profile.displayName || user.displayName || "");
      if (profile.location?.address) setAddress(profile.location.address);
      if (
        typeof profile.location?.lat === "number" &&
        typeof profile.location?.lng === "number"
      ) {
        setCoords({ lat: profile.location.lat, lng: profile.location.lng });
      }
    } else if (user.displayName) {
      setName(user.displayName);
    }
  }, [user, profile, profileStatus]);

  // Keep the draft current as they type, so a refresh or closed tab resumes
  // where they were. Only after the restore above, so it can't overwrite a
  // saved draft with the initial empty fields.
  useEffect(() => {
    if (!restoredRef.current || !user || step > 2) return;
    if (!name.trim() && !address.trim()) return;
    saveOnboardingDraft(user.uid, { name, address, coords, step });
  }, [user, name, address, coords, step]);

  // Redirect away only if the person is fully done (onboarded *and*
  // verified) when they first land here, and only check this once. It must
  // not re-run on every `profile` change: completeOnboarding flips
  // isOnboarded to true the moment step 3 saves, and if this kept reacting
  // to that, it would immediately bounce everyone to the dashboard before
  // they ever saw the outside-coverage/error screen below — and it would
  // make "Verify location" from the dashboard unusable, since arriving back
  // here with isOnboarded already true would bounce them straight back out.
  // Waits for a loaded profile: an unknown/failed profile must neither bounce
  // them nor be taken to mean they aren't onboarded.
  const didCheckInitialOnboardedRef = useRef(false);
  useEffect(() => {
    if (didCheckInitialOnboardedRef.current || loading || profileStatus !== "ready") return;
    didCheckInitialOnboardedRef.current = true;
    if (profile?.isOnboarded && profile?.verificationStatus === "verified") {
      router.push(DEFAULT_APP_ROUTE);
    }
  }, [loading, profile, profileStatus, router]);

  // Sets coords + a placeholder address immediately, then replaces it with a
  // real reverse-geocoded address once that resolves (left as-is if it fails).
  const applyDetectedLocation = async (
    lat: number,
    lng: number,
    approximate: boolean,
  ) => {
    setCoords({ lat, lng });
    setAddress(
      approximate
        ? `Approximate location (Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)})`
        : `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)} (Detected Location)`,
    );
    try {
      const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        if (data.address) setAddress(data.address);
      }
    } catch (err) {
      console.error("Reverse geocoding failed", err);
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setOnboardingError("Geolocation is not supported by your browser.");
      return;
    }
    setDetecting(true);
    setOnboardingError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await applyDetectedLocation(
          position.coords.latitude,
          position.coords.longitude,
          false,
        );
        setDetecting(false);
      },
      async (error) => {
        console.error(error);

        // GPS failed — fall back to an approximate location derived from the
        // request itself (hosting-platform geo headers, e.g. Vercel/
        // Cloudflare, or an IP-address lookup as a last resort).
        try {
          const res = await fetch("/api/ip-location");
          if (res.ok) {
            const data = await res.json();
            await applyDetectedLocation(data.lat, data.lng, true);
            setOnboardingError(
              "We couldn't get your exact GPS location, so we used your approximate network location instead. Please check the address below and adjust it if it's not quite right.",
            );
            setDetecting(false);
            return;
          }
        } catch (ipErr) {
          console.error("IP location fallback failed", ipErr);
        }

        if (error.code === error.PERMISSION_DENIED) {
          setOnboardingError(
            "Location permission was denied. Please allow location access for this site, or enter your address manually.",
          );
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setOnboardingError(
            "Your device couldn't determine a location just now — check that Location Services are enabled for your browser in your system settings, or enter your address manually.",
          );
        } else {
          setOnboardingError(
            "Location detection timed out. Please enter your address manually.",
          );
        }
        setDetecting(false);
      },
      { timeout: 10000 },
    );
  };

  const handleNextStep = async () => {
    if (step === 1) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        setOnboardingError("Please enter your name.");
        return;
      }
      if (trimmedName.length < NAME_MIN) {
        setOnboardingError(`Your name needs at least ${NAME_MIN} characters.`);
        return;
      }
      if (trimmedName.length > NAME_MAX) {
        setOnboardingError(`Please keep your name to ${NAME_MAX} characters or fewer.`);
        return;
      }
      if (!address.trim()) {
        setOnboardingError(
          "Add your home address, or use your current location.",
        );
        return;
      }
      setOnboardingError(null);

      if (!coords) {
        setGeocoding(true);
        try {
          const res = await fetch(
            `/api/geocode?address=${encodeURIComponent(address)}`,
          );
          if (!res.ok) throw new Error("Address not found");
          const data = await res.json();
          setCoords({ lat: data.lat, lng: data.lng });
        } catch (err) {
          console.error("Geocoding failed", err);
          setOnboardingError(
            "We couldn't find that address. Add your area and city (e.g. “Admiralty Way, Lekki Phase 1, Lagos”), or use your current location.",
          );
          setGeocoding(false);
          return;
        }
        setGeocoding(false);
      }

      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleSkip = () => {
    // No backend call here on purpose: completeOnboarding marks the account
    // isOnboarded, and we haven't verified a location for this person yet.
    // What they typed is already in their draft (saved as they type), so
    // it's still there if they come back to finish onboarding later.
    // Limited access until they verify: the app stops redirecting here, the
    // feed shows a "finish joining" card and neighbour-only areas stay locked.
    if (user) markOnboardingSkipped(user.uid);
    router.push(DEFAULT_APP_ROUTE);
  };

  // Saves the onboarding profile first, then checks the location. Saving
  // first means a failed save leaves nothing behind on the server (no
  // half-finished match), and by the time the location check runs, "your
  // details are saved" is true whatever it finds. Runs once when step 3
  // mounts; "Try again" re-runs only the location check (saveDetails =
  // false). verifyingStatus follows the real milestones (not a fixed timer),
  // so the checklist stays in sync with how long the calls actually take.
  const runVerification = useCallback(async (saveDetails = true) => {
    setVerifyingStatus(1); // step 1: coordinates present — a real, instant local check
    await new Promise((resolve) => setTimeout(resolve, LOCAL_CHECK_MIN_MS));

    if (saveDetails) {
      setVerifyingStatus(2); // step 2: saving name + address
      try {
        await completeOnboarding({
          displayName: name.trim(),
          location: {
            address,
            lat: coords?.lat || 0,
            lng: coords?.lng || 0,
          },
        });
      } catch (err) {
        console.error("Onboarding backend completion failed", err);
        // Session expired: AuthProvider signed them out and the effect above
        // sends them to login.
        if (isSessionError(err)) return;
        setOnboardingError(saveErrorMessage(err));
        setStep(1);
        return;
      }
      if (user) clearOnboardingDraft(user.uid);
      clearOnboardingSkipped();
    }

    setVerifyingStatus(3); // step 3: the real location check starts now
    let outcome: "success" | "unverified" | "nearby" | "error" = "success";
    try {
      const result = await verifyLocation({
        lat: coords?.lat || 0,
        lng: coords?.lng || 0,
      });
      if (result.verificationStatus === "unverified") {
        const nearby = result.nearbyHoods ?? [];
        setNearbyHoods(nearby);
        setSelectedHoodId(nearby[0]?.id ?? null);
        setRequestError(null);
        outcome = nearby.length > 0 ? "nearby" : "unverified";
      }
    } catch (verifyErr) {
      if (isSessionError(verifyErr)) return;
      // A failed *check* (network blip, backend hiccup) is not the same as
      // "outside coverage" — surface it distinctly instead of silently
      // treating it as success, which used to send people straight to the
      // dashboard with no idea verification never actually ran.
      console.error("Location verification failed", verifyErr);
      outcome = "error";
    }
    setVerifyingStatus(4); // location check settled

    setVerificationOutcome(outcome);
    if (outcome === "success") {
      // Hold the "Welcome to <neighbourhood>" screen long enough to read, then route.
      setTimeout(() => {
        router.push(DEFAULT_APP_ROUTE);
      }, 3000);
    }
    // The other outcomes stop here and wait for the user to choose what to
    // do next — see the buttons rendered for each state below.
  }, [coords, name, address, user, verifyLocation, completeOnboarding, router]);

  // runVerification's identity changes on every AuthProvider re-render
  // (verifyLocation/completeOnboarding/router aren't stable references
  // there), and calling it triggers exactly such a re-render (it calls
  // refreshProfile). If the effect below depended on runVerification
  // directly, that would re-arm it every time, which re-runs
  // runVerification, which re-renders AuthProvider, forever — an infinite
  // loop hammering the backend. A ref breaks that: the effect only depends
  // on `step`, and always calls whatever the latest runVerification is.
  const runVerificationRef = useRef(runVerification);
  useEffect(() => {
    runVerificationRef.current = runVerification;
  }, [runVerification]);

  // Step 3: kick off the real check as soon as this step is shown. The
  // checklist below renders straight off verifyingStatus/verificationOutcome,
  // so it reflects actual progress instead of a canned delay.
  useEffect(() => {
    if (step !== 3) return;
    setVerificationOutcome("pending");
    setVerifyingStatus(0);
    void runVerificationRef.current();
  }, [step]);

  const handleRetryVerification = () => {
    setVerificationOutcome("pending");
    // Details were saved before the check failed; only re-check the location.
    void runVerification(false);
  };

  const handleRequestHood = async () => {
    if (!selectedHoodId) return;
    setRequesting(true);
    setRequestError(null);
    try {
      await requestHood(selectedHoodId);
      setVerificationOutcome("requested");
    } catch (err) {
      console.error("Join request failed", err);
      if (isSessionError(err)) return;
      setRequestError(
        err instanceof ApiError ? err.message : "We couldn't send your request. Please try again.",
      );
    } finally {
      setRequesting(false);
    }
  };

  const handleEditAddress = () => {
    setVerificationOutcome("pending");
    setStep(1);
  };

  const handleContinueToDashboard = () => {
    router.push(DEFAULT_APP_ROUTE);
  };

  if (!loading && user && profileStatus === "error") {
    return (
      <OnboardingShell step={1}>
        <ProblemState
          title="We couldn't load your account"
          message={profileError?.message ?? "Something went wrong. Please try again."}
          kind={profileError?.kind ?? null}
          onRetry={() => void refreshProfile()}
        />
      </OnboardingShell>
    );
  }

  if (loading || !user || profileStatus !== "ready") {
    return (
      <OnboardingShell step={1}>
        <div className="space-y-4" aria-busy aria-label="Loading">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell step={step} onSkip={step < 3 ? handleSkip : undefined}>
      {step === 1 && (
        <DetailsStep
          name={name}
          address={address}
          hasCoords={!!coords}
          detecting={detecting}
          geocoding={geocoding}
          error={onboardingError}
          onName={setName}
          onAddress={(value) => {
            setAddress(value);
            // Manual edits invalidate any previously detected coordinates.
            setCoords(null);
          }}
          onDetect={handleDetectLocation}
          onNext={() => void handleNextStep()}
        />
      )}
      {step === 2 && (
        <ConfirmStep address={address} coords={coords} onBack={() => setStep(1)} onNext={() => void handleNextStep()} />
      )}
      {step === 3 && verificationOutcome === "nearby" && (
        <NearbyHoodsStep
          hoods={nearbyHoods}
          selectedId={selectedHoodId}
          requesting={requesting}
          error={requestError}
          onSelect={setSelectedHoodId}
          onRequest={() => void handleRequestHood()}
          onEditAddress={handleEditAddress}
          onNotNow={handleContinueToDashboard}
        />
      )}
      {step === 3 && verificationOutcome === "requested" && (
        <RequestSentStep
          hoodName={nearbyHoods.find((h) => h.id === selectedHoodId)?.name ?? profile?.requestedHood?.name ?? "the neighbourhood"}
          onContinue={handleContinueToDashboard}
        />
      )}
      {step === 3 && verificationOutcome !== "nearby" && verificationOutcome !== "requested" && (
        <VerifyStep
          status={verifyingStatus}
          outcome={verificationOutcome}
          neighbourhoodName={neighbourhood?.name ?? null}
          onRetry={handleRetryVerification}
          onEditAddress={handleEditAddress}
          onContinue={handleContinueToDashboard}
        />
      )}
    </OnboardingShell>
  );
}
