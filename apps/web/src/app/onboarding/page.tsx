"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@myhoodora/ui/button";
import { Input } from "@myhoodora/ui/input";
import { Logo } from "@myhoodora/ui/logo";
import {
  MapPin,
  Navigation,
  ArrowRight,
  ShieldCheck,
  Check,
} from "lucide-react";
import { Skeleton } from "@myhoodora/ui/skeleton";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, completeOnboarding, loading } = useAuth();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [detecting, setDetecting] = useState(false);
  const [verifyingStatus, setVerifyingStatus] = useState(0);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

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

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setOnboardingError("Geolocation is not supported by your browser.");
      return;
    }
    setDetecting(true);
    setOnboardingError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ lat: latitude, lng: longitude });
        setAddress(
          `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)} (Detected Location)`,
        );
        setDetecting(false);
      },
      (error) => {
        console.error(error);
        setOnboardingError(
          "Unable to detect location. Please enter your address manually.",
        );
        setDetecting(false);
      },
      { timeout: 10000 },
    );
  };

  const handleNextStep = () => {
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
        await completeOnboarding({
          displayName: name,
          location: {
            address,
            lat: coords?.lat || 0,
            lng: coords?.lng || 0,
          },
        });
        // Wait another moment for the success state, then route
        setTimeout(() => {
          router.push("/dashboard");
        }, 1200);
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
  }, [step, name, address, coords, completeOnboarding, router]);

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
    { title: "Verification", desc: "Neighborhood Check" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-foreground font-sans">
      {/* Top Header */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-white">
        <Logo size="md" />
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
                  <h2 className="text-2xl font-black mb-2 tracking-tight">
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
                        Neighborhood Address
                      </label>
                      <button
                        type="button"
                        onClick={handleDetectLocation}
                        disabled={detecting}
                        className="text-xs font-extrabold text-primary hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Navigation
                          className={`size-3 ${detecting ? "animate-pulse" : ""}`}
                        />
                        {detecting ? "Detecting..." : "Use current location"}
                      </button>
                    </div>
                    <Input
                      type="text"
                      placeholder="123 Neighborhood St, City"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                </div>

                <Button className="w-full mt-4" onClick={handleNextStep}>
                  Continue
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            )}

            {/* STEP 2: Mock map preview */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-black mb-2 tracking-tight">
                    Confirm your neighborhood
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    We detected you belong in the local community map section
                    below.
                  </p>
                </div>

                {/* Styled CSS Mock Map */}
                <div className="relative h-48 w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center">
                  {/* Grid Lines Mock Map Background */}
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage: `
                        radial-gradient(circle, #0D9488 1px, transparent 1px),
                        linear-gradient(to right, #ccc 1px, transparent 1px),
                        linear-gradient(to bottom, #ccc 1px, transparent 1px)
                      `,
                      backgroundSize: "20px 20px, 40px 40px, 40px 40px",
                    }}
                  ></div>

                  {/* Circular Boundary Grid */}
                  <div className="absolute size-36 border-2 border-dashed border-primary/20 rounded-full animate-pulse opacity-40"></div>

                  {/* Pulsing Marker */}
                  <div className="relative z-10 flex flex-col items-center">
                    <span className="absolute -top-3 size-6 bg-primary/20 rounded-full animate-ping"></span>
                    <MapPin className="size-8 text-primary fill-primary/30 relative z-10" />
                  </div>

                  {/* Coordinate Metadata Tag */}
                  <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-600 shadow-sm flex items-center gap-1.5">
                    <Navigation className="size-3 text-primary animate-spin" />
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
                  <h3 className="text-lg font-black">
                    Verifying Address Authenticity
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Please stand by while we verify your address fits local
                    neighborhood guidelines.
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
                      Setting up neighborhood feed access...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
