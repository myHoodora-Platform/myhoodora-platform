"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@myhoodora/ui/button";
import { Input } from "@myhoodora/ui/input";
import { MascotWordmark } from "@myhoodora/ui/logo";
import {
  MapPin,
  Navigation,
  ArrowRight,
  ShieldCheck,
  Check,
} from "lucide-react";
import { Skeleton } from "@myhoodora/ui/skeleton";
import { LocationMap } from "@/components/onboarding/location-map";
import { DEFAULT_APP_ROUTE } from "@/lib/routes";

const ONBOARDING_DRAFT_KEY = "myhoodora:onboarding-draft";

// How long to hold checklist step 1 ("Checking address coordinates") visible
// before moving to step 2. That check is really just "do we have coordinates
// to send?" — true the instant runVerification runs — so without a small
// floor it would flip to done in the same frame as step 2, and both would
// visually tick together. Step 2 onward has no floor: each is held open for
// exactly as long as its real network call takes.
const LOCAL_CHECK_MIN_MS = 300;

interface OnboardingDraft {
  name: string;
  address: string;
  coords: { lat: number; lng: number } | null;
}

// Skipping onboarding shouldn't mean retyping everything later — these just
// keep the step-1 fields around locally (no backend write, no isOnboarded
// change) so the form is pre-filled next time someone lands back here, e.g.
// via the "finish onboarding" prompt on a gated action.
function readOnboardingDraft(): OnboardingDraft | null {
  try {
    const raw = localStorage.getItem(ONBOARDING_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as OnboardingDraft) : null;
  } catch {
    return null;
  }
}

function saveOnboardingDraft(draft: OnboardingDraft) {
  try {
    localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Private browsing / full storage — losing the draft isn't fatal.
  }
}

function clearOnboardingDraft() {
  try {
    localStorage.removeItem(ONBOARDING_DRAFT_KEY);
  } catch {
    // Nothing to do if storage is unavailable.
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, completeOnboarding, verifyLocation, loading } =
    useAuth();
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
    "pending" | "success" | "unverified" | "error"
  >("pending");

  // Restore a saved draft (from an earlier "Skip onboarding"), then fall back
  // to whatever's already on the account (a previous onboarding attempt —
  // someone retrying verification shouldn't have to retype their address),
  // then finally the Firebase display name.
  useEffect(() => {
    if (name) return;
    const draft = readOnboardingDraft();
    if (draft?.name) {
      setName(draft.name);
      if (draft.address) setAddress(draft.address);
      if (draft.coords) setCoords(draft.coords);
    } else if (profile?.displayName || profile?.location?.address) {
      setName(profile.displayName || user?.displayName || "");
      if (profile.location?.address) setAddress(profile.location.address);
      if (
        typeof profile.location?.lat === "number" &&
        typeof profile.location?.lng === "number"
      ) {
        setCoords({ lat: profile.location.lat, lng: profile.location.lng });
      }
    } else if (user?.displayName) {
      setName(user.displayName);
    }
  }, [user, profile, name]);

  // Redirect away only if the person is fully done (onboarded *and*
  // verified) when they first land here, and only check this once. It must
  // not re-run on every `profile` change: completeOnboarding flips
  // isOnboarded to true the moment step 3 saves, and if this kept reacting
  // to that, it would immediately bounce everyone to the dashboard before
  // they ever saw the outside-coverage/error screen below — and it would
  // make "Verify location" from the dashboard unusable, since arriving back
  // here with isOnboarded already true would bounce them straight back out.
  const didCheckInitialOnboardedRef = useRef(false);
  useEffect(() => {
    if (didCheckInitialOnboardedRef.current || loading) return;
    didCheckInitialOnboardedRef.current = true;
    if (profile?.isOnboarded && profile?.verificationStatus === "verified") {
      router.push(DEFAULT_APP_ROUTE);
    }
  }, [loading, profile, router]);

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
      if (!name.trim()) {
        setOnboardingError("Please enter your name.");
        return;
      }
      if (!address.trim()) {
        setOnboardingError(
          "Please enter your address or detect your location.",
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
            "We couldn't locate that address. Please check it, or use \"Use current location\" instead.",
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
    // Just keep what they typed locally so it's still there if they come
    // back to finish onboarding later (e.g. via a "finish onboarding" prompt).
    if (name.trim() || address.trim()) {
      saveOnboardingDraft({ name, address, coords });
    }
    router.push(DEFAULT_APP_ROUTE);
  };

  // Attempts real verification, then always saves the onboarding profile
  // (isOnboarded should flip regardless of coverage outcome). Runs once when
  // step 3 mounts, and again on "Try again". verifyingStatus is driven by
  // these real milestones (not a fixed timer), so the checklist below stays
  // in sync with how long the calls actually take instead of finishing
  // early and then appearing to hang.
  const runVerification = useCallback(async () => {
    setVerifyingStatus(1); // step 1: coordinates present — a real, instant local check
    await new Promise((resolve) => setTimeout(resolve, LOCAL_CHECK_MIN_MS));

    setVerifyingStatus(2); // step 2: the real location check starts now
    let outcome: "success" | "unverified" | "error" = "success";
    try {
      const result = await verifyLocation({
        lat: coords?.lat || 0,
        lng: coords?.lng || 0,
      });
      if (result.verificationStatus === "unverified") {
        outcome = "unverified";
      }
    } catch (verifyErr) {
      // A failed *check* (network blip, backend hiccup) is not the same as
      // "outside coverage" — surface it distinctly instead of silently
      // treating it as success, which used to send people straight to the
      // dashboard with no idea verification never actually ran.
      console.error("Location verification failed", verifyErr);
      outcome = "error";
    }
    setVerifyingStatus(3); // step 2 settled (either way) — step 3, the profile save, starts now

    try {
      await completeOnboarding({
        displayName: name,
        location: {
          address,
          lat: coords?.lat || 0,
          lng: coords?.lng || 0,
        },
      });
    } catch (err) {
      console.error("Onboarding backend completion failed", err);
      setOnboardingError(
        "Verification could not be saved to backend. Please retry.",
      );
      setStep(1);
      return;
    }
    setVerifyingStatus(4); // step 3 settled

    clearOnboardingDraft();
    setVerificationOutcome(outcome);
    if (outcome === "success") {
      // Hold the fully-checked state for a beat so it's not gone-in-a-flash, then route
      setTimeout(() => {
        router.push(DEFAULT_APP_ROUTE);
      }, 900);
    }
    // "unverified" and "error" stop here and wait for the user to choose
    // what to do next — see the buttons rendered for each state below.
  }, [coords, name, address, verifyLocation, completeOnboarding, router]);

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
    void runVerification();
  };

  const handleEditAddress = () => {
    setVerificationOutcome("pending");
    setStep(1);
  };

  const handleContinueToDashboard = () => {
    router.push(DEFAULT_APP_ROUTE);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-foreground font-sans">
        {/* Top Header Skeleton */}
        <header className="w-full px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-white">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-6 w-12" />
        </header>

        {/* Main Content Skeleton */}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-lg overflow-hidden max-w-4xl w-full grid md:grid-cols-[280px_1fr] min-h-[500px]">
            {/* Left Panel Step Progress Skeleton */}
            <div className="bg-slate-50/50 p-8 border-r border-slate-100 space-y-8 hidden md:block">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex gap-4 items-start animate-pulse">
                  <Skeleton className="size-8 rounded-full shrink-0" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
              ))}
            </div>

            {/* Right Panel Content Skeleton */}
            <div className="p-8 md:p-12 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-4 w-72" />
                </div>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              </div>
              <Skeleton className="h-10 w-full mt-8" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  const stepsList = [
    { title: "Your details", desc: "Name & Address" },
    { title: "Confirm location", desc: "Interactive Map" },
    { title: "Verification", desc: "Neighbourhood Check" },
  ];

  // Checklist item state, derived from the real verifyingStatus milestones
  // set inside runVerification — not a timer, so these track the actual
  // calls in flight rather than finishing before the work is done. Each item
  // gets its own active/done window (1→2, 2→3, 3→4) instead of sharing one,
  // so they visibly complete one after another rather than all at once.
  const coordsCheckActive = verifyingStatus === 1;
  const coordsCheckDone = verifyingStatus >= 2;

  const locationCheckActive = verifyingStatus === 2;
  const locationCheckDone = verifyingStatus >= 3 && verificationOutcome !== "error";
  const locationCheckFailed = verifyingStatus >= 3 && verificationOutcome === "error";

  const profileSaveActive = verifyingStatus === 3;
  const profileSaveDone = verifyingStatus >= 4;

  function checklistItemClasses(active: boolean, done: boolean, failed: boolean) {
    if (failed) return "bg-destructive text-white";
    if (done) return "bg-primary text-white";
    if (active) return "bg-primary/20 text-primary animate-pulse";
    return "bg-slate-200 text-slate-500";
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-foreground font-sans">
      {/* Top Header */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-white">
        <MascotWordmark size="md" />
        <button
          onClick={handleSkip}
          className="text-xs font-semibold text-muted-foreground uppercase tracking-widest hover:text-primary transition-colors"
        >
          Skip onboarding
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-sm border border-slate-100 p-8 md:p-12">
          {/* Stepper Progress Bar */}
          <div className="flex items-center justify-between mb-12 relative w-full px-4">
            {/* Background Line */}
            <div className="absolute top-4 left-10 right-10 h-0.5 bg-slate-100 -z-0"></div>
            {/* Active Progress Line — nested inside a left-10/right-10 track that
                matches the background line's bounds, so "100%" width lands exactly
                on the last node instead of the full-width row it used to size
                against (which overshot past step 3, worst on narrow screens). */}
            <div className="absolute top-4 left-10 right-10 h-0.5 -z-0 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${step === 1 ? "0%" : step === 2 ? "50%" : "100%"}`,
                }}
              ></div>
            </div>

            {stepsList.map((item, idx) => {
              const currentStep = idx + 1;
              const isCompleted = step > currentStep;
              const isActive = step === currentStep;

              return (
                <div
                  key={idx}
                  className="flex flex-col items-center relative z-10 text-center flex-1"
                >
                  {/* Step Node Icon/Bubble */}
                  <div
                    className={`size-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                      isCompleted
                        ? "bg-primary border-primary text-white"
                        : isActive
                          ? "bg-white border-primary text-primary shadow-lg shadow-primary/10 ring-4 ring-primary/10"
                          : "bg-white border-slate-200 text-slate-400"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="size-4" />
                    ) : (
                      <span className="text-xs font-bold">{currentStep}</span>
                    )}
                  </div>
                  {/* Step Info */}
                  <span
                    className={`text-xs font-bold mt-3 block ${
                      isActive ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {item.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60 hidden sm:block">
                    {item.desc}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Stepper Body Forms */}
          <div className="min-h-[250px]">
            {onboardingError && (
              <div className="mb-6 p-4 bg-destructive/10 text-destructive text-sm font-semibold rounded-xl flex items-center gap-2">
                <MapPin className="size-5 shrink-0 stroke-destructive" />
                <span>{onboardingError}</span>
              </div>
            )}

            {/* STEP 1: Name and Location Form */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2 tracking-tight">
                    Tell us about yourself
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Enter your name and address to find your local neighbourhood
                    community.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                      Your Full Name
                    </label>
                    <Input
                      type="text"
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2 px-1">
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Neighbourhood Address
                      </label>
                      <button
                        type="button"
                        onClick={handleDetectLocation}
                        disabled={detecting}
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Navigation
                          className={`size-3 ${detecting ? "animate-pulse" : ""}`}
                        />
                        {detecting ? "Detecting..." : "Use current location"}
                      </button>
                    </div>
                    <Input
                      type="text"
                      placeholder="123 Neighbourhood St, City"
                      value={address}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        // Manual edits invalidate any previously detected coordinates.
                        setCoords(null);
                      }}
                    />
                  </div>
                </div>

                <Button
                  className="w-full mt-4"
                  onClick={handleNextStep}
                  disabled={geocoding}
                >
                  {geocoding ? "Locating address..." : "Continue"}
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            )}

            {/* STEP 2: Mock map preview */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2 tracking-tight">
                    Confirm your neighbourhood
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    We detected you belong in the local community map section
                    below.
                  </p>
                </div>

                {/* Real map, centered on the detected/geocoded coordinates */}
                <div className="relative h-48 w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                  {coords && <LocationMap lat={coords.lat} lng={coords.lng} />}

                  {/* Coordinate Metadata Tag — top-left, not bottom: MapLibre's
                      required attribution control lives bottom-left, and on a
                      narrow phone width there isn't room for both a badge and
                      the attribution text on the same row without them
                      colliding (the zoom control already owns top-right). */}
                  <div className="absolute z-[1000] top-3 left-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-600 shadow-sm flex items-center gap-1.5 pointer-events-none">
                    <Navigation className="size-3 text-primary" />
                    GPS Connected
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-start gap-3">
                  <MapPin className="size-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold">Detected Address</h4>
                    <p className="text-xs text-muted-foreground">{address}</p>
                  </div>
                </div>

                {/* Stacked full-width on mobile so "Verify Details" + icon never
                    wraps to two lines in a half-width button; side-by-side from
                    sm: up, matching the pattern used on the 404 page. */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    variant="outline"
                    className="w-full sm:flex-1"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                  <Button className="w-full sm:flex-1" onClick={handleNextStep}>
                    Verify Details
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: Verification Mocking Loader */}
            {step === 3 && (
              <div className="flex flex-col items-center justify-center py-10 space-y-6">
                <div className="relative size-16 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
                  <div
                    className={`absolute inset-0 rounded-full border-4 border-t-transparent ${
                      verificationOutcome === "error"
                        ? "border-destructive"
                        : verificationOutcome === "unverified"
                          ? "border-amber-400"
                          : "border-primary"
                    } ${verificationOutcome === "pending" ? "animate-spin" : ""}`}
                  ></div>
                  <ShieldCheck
                    className={`size-6 ${
                      verificationOutcome === "error"
                        ? "text-destructive"
                        : verificationOutcome === "unverified"
                          ? "text-amber-500"
                          : "text-primary"
                    }`}
                  />
                </div>

                <div className="text-center space-y-2 max-w-sm">
                  <h3 className="text-lg font-bold">
                    {verificationOutcome === "unverified"
                      ? "You're outside our coverage area"
                      : verificationOutcome === "error"
                        ? "Couldn't verify your location"
                        : "Verifying Address Authenticity"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {verificationOutcome === "unverified"
                      ? "Your details are saved. You can still continue — you just won't see a neighbourhood feed yet."
                      : verificationOutcome === "error"
                        ? "Your details are already saved — this is just the location check. You can try again or continue anyway."
                        : "Please stand by while we verify your address fits local neighbourhood guidelines."}
                  </p>
                </div>

                {/* Sub-steps of verification — reflect real progress, not a timer */}
                <div className="w-full max-w-xs space-y-3 bg-slate-50 p-5 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3 text-xs">
                    <div
                      className={`size-4 rounded-full flex items-center justify-center text-[10px] font-bold ${checklistItemClasses(coordsCheckActive, coordsCheckDone, false)}`}
                    >
                      {coordsCheckDone ? "✓" : "1"}
                    </div>
                    <span
                      className={
                        coordsCheckActive || coordsCheckDone
                          ? "font-bold text-slate-800"
                          : "text-slate-400"
                      }
                    >
                      Checking address coordinates...
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div
                      className={`size-4 rounded-full flex items-center justify-center text-[10px] font-bold ${checklistItemClasses(locationCheckActive, locationCheckDone, locationCheckFailed)}`}
                    >
                      {locationCheckFailed ? "!" : locationCheckDone ? "✓" : "2"}
                    </div>
                    <span
                      className={
                        locationCheckActive || locationCheckDone || locationCheckFailed
                          ? "font-bold text-slate-800"
                          : "text-slate-400"
                      }
                    >
                      Checking active sector boundary...
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div
                      className={`size-4 rounded-full flex items-center justify-center text-[10px] font-bold ${checklistItemClasses(profileSaveActive, profileSaveDone, false)}`}
                    >
                      {profileSaveDone ? "✓" : "3"}
                    </div>
                    <span
                      className={
                        profileSaveActive || profileSaveDone
                          ? "font-bold text-slate-800"
                          : "text-slate-400"
                      }
                    >
                      Setting up neighbourhood feed access...
                    </span>
                  </div>
                </div>

                {verificationOutcome === "unverified" && (
                  <div className="flex w-full max-w-xs gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={handleEditAddress}
                    >
                      Edit address
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleContinueToDashboard}
                    >
                      Continue
                    </Button>
                  </div>
                )}

                {verificationOutcome === "error" && (
                  <div className="w-full max-w-xs space-y-2">
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={handleEditAddress}
                      >
                        Edit address
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={handleRetryVerification}
                      >
                        Try again
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={handleContinueToDashboard}
                    >
                      Continue anyway
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
