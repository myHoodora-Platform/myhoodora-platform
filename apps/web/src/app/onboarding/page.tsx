"use client";

import React, { useState, useEffect } from "react";
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
  const [coverageNotice, setCoverageNotice] = useState<string | null>(null);

  // Initialize name from Firebase user profile
  useEffect(() => {
    if (user?.displayName && !name) {
      setName(user.displayName);
    }
  }, [user, name]);

  // If already onboarded on mount and not loading, redirect to dashboard
  useEffect(() => {
    if (!loading && profile?.isOnboarded) {
      router.push("/dashboard");
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
    router.push("/dashboard");
  };

  // Step 3: Mock Verification Sequencer & Backend Completion
  useEffect(() => {
    if (step !== 3) return;

    const timer1 = setTimeout(() => setVerifyingStatus(1), 1200);
    const timer2 = setTimeout(() => setVerifyingStatus(2), 2400);
    const timer3 = setTimeout(() => setVerifyingStatus(3), 3600);

    const finalize = async () => {
      try {
        let unverified = false;
        try {
          const result = await verifyLocation({
            lat: coords?.lat || 0,
            lng: coords?.lng || 0,
          });
          if (result.verificationStatus === "unverified") {
            unverified = true;
            setCoverageNotice(
              "You're outside our current coverage area right now — you can still continue, but you won't see a neighbourhood feed yet.",
            );
          }
        } catch (verifyErr) {
          console.error("Location verification failed", verifyErr);
        }

        await completeOnboarding({
          displayName: name,
          location: {
            address,
            lat: coords?.lat || 0,
            lng: coords?.lng || 0,
          },
        });
        // Wait another moment for the success state, then route
        setTimeout(
          () => {
            router.push("/dashboard");
          },
          unverified ? 2600 : 1200,
        );
      } catch (err) {
        console.error("Onboarding backend completion failed", err);
        setOnboardingError(
          "Verification could not be saved to backend. Please retry.",
        );
        setStep(1);
      }
    };

    const timer4 = setTimeout(finalize, 4800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [step, name, address, coords, completeOnboarding, verifyLocation, router]);

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
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden max-w-4xl w-full grid md:grid-cols-[280px_1fr] min-h-[500px]">
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

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-foreground font-sans">
      {/* Top Header */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-white">
        <MascotWordmark size="md" />
        <button
          onClick={handleSkip}
          className="text-xs font-bold text-muted-foreground uppercase tracking-widest hover:text-primary transition-colors"
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
            {/* Active Progress Line */}
            <div
              className="absolute top-4 left-10 h-0.5 bg-primary transition-all duration-300 -z-0"
              style={{
                width: `${step === 1 ? "0%" : step === 2 ? "50%" : "100%"}`,
              }}
            ></div>

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
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
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
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
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

                  {/* Coordinate Metadata Tag */}
                  <div className="absolute z-[1000] bottom-3 left-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-600 shadow-sm flex items-center gap-1.5 pointer-events-none">
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

                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                  <Button className="flex-1" onClick={handleNextStep}>
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
                  <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                  <ShieldCheck className="size-6 text-primary" />
                </div>

                <div className="text-center space-y-2 max-w-sm">
                  <h3 className="text-lg font-bold">
                    Verifying Address Authenticity
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Please stand by while we verify your address fits local
                    neighbourhood guidelines.
                  </p>
                </div>

                {/* Sub-steps of verification */}
                <div className="w-full max-w-xs space-y-3 bg-slate-50 p-5 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3 text-xs">
                    <div
                      className={`size-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        verifyingStatus >= 0
                          ? "bg-primary text-white"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {verifyingStatus > 0 ? "✓" : "1"}
                    </div>
                    <span
                      className={
                        verifyingStatus >= 0
                          ? "font-bold text-slate-800"
                          : "text-slate-400"
                      }
                    >
                      Checking address coordinates...
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div
                      className={`size-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        verifyingStatus >= 1
                          ? "bg-primary text-white"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {verifyingStatus > 1 ? "✓" : "2"}
                    </div>
                    <span
                      className={
                        verifyingStatus >= 1
                          ? "font-bold text-slate-800"
                          : "text-slate-400"
                      }
                    >
                      Checking active sector boundary...
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div
                      className={`size-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        verifyingStatus >= 2
                          ? "bg-primary text-white"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {verifyingStatus > 2 ? "✓" : "3"}
                    </div>
                    <span
                      className={
                        verifyingStatus >= 2
                          ? "font-bold text-slate-800"
                          : "text-slate-400"
                      }
                    >
                      Setting up neighbourhood feed access...
                    </span>
                  </div>
                </div>

                {coverageNotice && (
                  <div className="w-full max-w-xs p-3 bg-amber-50 text-amber-800 text-xs font-semibold rounded-xl flex items-center gap-2">
                    <MapPin className="size-4 shrink-0" />
                    <span>{coverageNotice}</span>
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
