import { ApiError, errorMessage } from "@myhoodora/api-contract/errors";
import { EMPTY_ADDRESS, joinAddress, splitAddress, type AddressParts } from "@myhoodora/api-contract/lookups";
import type { LocationPreview, NearbyHood } from "@myhoodora/api-contract/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { currentPosition, geocode, POSITION_PROBLEM, reverseGeocode, type Coords } from "@/core/location/location";
import { clearDraft, clearOnboardingSkipped, readDraft, saveDraft, type CoordsSource } from "@/core/onboarding/onboarding-store";
import { completeOnboarding, previewLocation, requestHood, verifyLocation } from "./onboarding-api";
import { confirmAction, coordsFollowAddress, detailsErrors, type DetailsErrors } from "./onboarding-rules";
import { signal } from "@/features/feedback/engagement";

/**
 * The web's onboarding (apps/web/src/app/onboarding), on a phone and without the map:
 *
 *   details ──continue──► confirm ──join / continue──► verifying ─┬─► joined
 *     ▲                     │ only the area was found:            ├─► nearby ──request──► requested
 *     └──── edit ◄──────────┘ use GPS or fix the street           ├─► outside (no Hood near)
 *                                                                  └─► failed (details saved: retry the check)
 *
 * Nothing is saved until "join"/"continue": the details first (marks the account onboarded), then the
 * location check into the Hood they saw. A 409 (the point isn't in that Hood) changes nothing and
 * returns to confirm. What's typed is kept on the phone as a draft, so leaving and coming back resumes.
 */
export type Step = "loading" | "details" | "confirm" | "verifying" | "joined" | "nearby" | "requested" | "outside" | "failed";

/** Step 3's checklist, moved on by the real calls, never by a timer. */
export type Milestone = "saving" | "matching";

export type LocateState = { status: "idle" | "locating" } | { status: "found"; accuracyM: number | null } | { status: "failed"; message: string };

interface Point {
  value: Coords;
  source: CoordsSource;
  accuracyM: number | null;
}

const DRAFT_SAVE_DELAY_MS = 400;

export function useOnboarding() {
  const user = useSignedInUser();
  const { profile, refreshProfile } = useAuth();
  const [step, setStep] = useState<Step>("loading");
  const [name, setName] = useState("");
  const [address, setAddress] = useState<AddressParts>(EMPTY_ADDRESS);
  const [point, setPoint] = useState<Point | null>(null);
  const [locate, setLocate] = useState<LocateState>({ status: "idle" });
  const [errors, setErrors] = useState<DetailsErrors | null>(null);
  /** A problem with the step as a whole (lookup failed, request refused), shown above its actions. */
  const [problem, setProblem] = useState<string | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0);
  /** The last answer, and the point (and attempt) it's for: a stale one is never shown for a new point. */
  const [answer, setAnswer] = useState<{ key: string; preview?: LocationPreview; error?: unknown } | null>(null);
  const [milestone, setMilestone] = useState<Milestone>("saving");
  const [busy, setBusy] = useState<null | "finding" | "requesting" | "leaving">(null);
  const [nearby, setNearby] = useState<NearbyHood[]>([]);
  const [selectedHoodId, setSelectedHoodId] = useState<string | null>(null);
  const [joinedHood, setJoinedHood] = useState<string | null>(null);
  /** The profile is reloaded with the outcome: the screen can leave for the feed. */
  const [finished, setFinished] = useState(false);
  /** The Hood they said yes to: the API won't put them anywhere else. */
  const confirmedHood = useRef<string | undefined>(undefined);
  /** One action at a time, even with taps faster than a render. */
  const inFlight = useRef(false);

  const once = useCallback(async (work: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await work();
    } finally {
      inFlight.current = false;
    }
  }, []);

  // Resume: this phone's draft, else what an earlier attempt saved on the account, else the sign-in name.
  useEffect(() => {
    let alive = true;
    void readDraft(user.uid).then((draft) => {
      if (!alive) return;
      if (draft && (draft.name.trim() || joinAddress(draft.address))) {
        setName(draft.name);
        setAddress(draft.address);
        if (draft.coords && draft.source) setPoint({ value: draft.coords, source: draft.source, accuracyM: draft.accuracyM });
        setStep(draft.step === "confirm" && draft.coords ? "confirm" : "details");
        return;
      }
      setName(profile?.displayName || user.displayName || "");
      const loc = profile?.location;
      if (loc?.address) setAddress(splitAddress(loc.address));
      if (typeof loc?.lat === "number" && typeof loc?.lng === "number") setPoint({ value: { lat: loc.lat, lng: loc.lng }, source: "saved", accuracyM: null });
      setStep("details");
    });
    return () => {
      alive = false;
    };
    // Once per account: later profile refreshes must not overwrite what they're typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid]);

  // Keep the draft current while they're on steps 1 and 2 (debounced: it's a Keychain write).
  useEffect(() => {
    if ((step !== "details" && step !== "confirm") || (!name.trim() && !joinAddress(address))) return;
    const timer = setTimeout(() => {
      void saveDraft(user.uid, { name, address, coords: point?.value ?? null, source: point?.source ?? null, accuracyM: point?.accuracyM ?? null, step });
    }, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [user.uid, step, name, address, point]);

  // Step 2: which Hood the point is in. Asked on arrival and on "try again"; not for an area's middle.
  const previewKey = step === "confirm" && point && point.source !== "area" ? `${point.value.lat},${point.value.lng}#${previewNonce}` : null;
  useEffect(() => {
    if (!previewKey || !point) return;
    let alive = true;
    previewLocation(user, point.value)
      .then((p) => alive && setAnswer({ key: previewKey, preview: p }))
      .catch((error: unknown) => alive && setAnswer({ key: previewKey, error }));
    return () => {
      alive = false;
    };
    // The key says when to ask again; `point` is read for its value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, previewKey]);
  const current = answer && answer.key === previewKey ? answer : null;
  const preview = current?.preview ?? null;
  const previewError = current?.error ?? null;

  const editName = (value: string) => {
    setName(value);
    setErrors((e) => (e?.name ? { ...e, name: undefined } : e));
  };

  /** Typing changes the address: a point looked up from it is out of date. GPS stays (home hasn't moved). */
  const editAddress = (patch: Partial<AddressParts>) => {
    setAddress((a) => ({ ...a, ...patch }));
    setErrors((e) => (e ? { ...e, ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])) } : e));
    setPoint((p) => (p && coordsFollowAddress(p.source) ? null : p));
  };

  /** "Not at home right now?": look up the typed address instead of the phone's location. */
  const forgetLocation = () => {
    setPoint(null);
    setLocate({ status: "idle" });
  };

  const locateMe = () =>
    once(async () => {
      setProblem(null);
      setLocate({ status: "locating" });
      const position = await currentPosition();
      if (!position.ok) {
        setLocate({ status: "failed", message: POSITION_PROBLEM[position.reason] });
        return;
      }
      setPoint({ value: position.coords, source: "gps", accuracyM: position.accuracyM });
      setLocate({ status: "found", accuracyM: position.accuracyM });
      // Fill the fields to check; a failed lookup only means typing them. Typed fields stay as typed.
      const place = await reverseGeocode(user, position.coords).catch(() => null);
      if (place) {
        setAddress((typed) => ({
          street: place.parts.street || typed.street,
          area: place.parts.area || typed.area,
          city: place.parts.city || typed.city,
        }));
        setErrors(null);
      }
    });

  /** Step 1 → 2: check the fields, find the address if there's no point yet, then show its Hood. */
  const toConfirm = () =>
    once(async () => {
      setProblem(null);
      const found = detailsErrors(name, address);
      setErrors(found);
      if (found) return;
      if (point) {
        setStep("confirm");
        return;
      }
      setBusy("finding");
      try {
        const match = await geocode(user, address).catch((err: unknown) => {
          if (err instanceof ApiError && err.kind === "not_found") return null;
          throw err;
        });
        if (!match) {
          setProblem(`We couldn't find ${address.area.trim()} in ${address.city.trim()}. Check the spelling, or use your current location.`);
          return;
        }
        setPoint({ value: { lat: match.lat, lng: match.lng }, source: match.precision, accuracyM: null });
        setStep("confirm");
      } catch (err) {
        setProblem(errorMessage(err));
      } finally {
        setBusy(null);
      }
    });

  const backToDetails = () => {
    setProblem(null);
    setStep("details");
  };

  /** The location check, after the details are saved. Outcomes as on the web. */
  const verify = useCallback(async () => {
    if (!point) return;
    setMilestone("matching");
    try {
      const result = await verifyLocation(user, point.value, confirmedHood.current);
      if (result.verificationStatus === "verified") {
        signal(user, "address_verified");
        setJoinedHood(preview?.hood?.name ?? null);
        setStep("joined");
        return;
      }
      const close = result.nearbyHoods ?? [];
      setNearby(close);
      setSelectedHoodId(close[0]?.id ?? null);
      setStep(close.length ? "nearby" : "outside");
    } catch (err) {
      // 409: the point isn't in the Hood they confirmed (or they can't move yet). Nothing changed: look again.
      if (err instanceof ApiError && err.status === 409) {
        setProblem(err.message);
        setPreviewNonce((n) => n + 1);
        setStep("confirm");
        return;
      }
      setProblem(errorMessage(err));
      setStep("failed");
    }
  }, [user, point, preview]);

  /** Step 2's main button: save the details, then check the location into the Hood they saw. */
  const confirm = () =>
    once(async () => {
      if (!point || !preview) return;
      const action = confirmAction(preview, point.source);
      if (action.kind === "blocked") return;
      confirmedHood.current = action.kind === "join" ? action.hoodId : undefined;
      setProblem(null);
      setStep("verifying");
      // Saved every time through here (they may have edited the address); "try again" only re-checks.
      setMilestone("saving");
      try {
        await completeOnboarding(user, { displayName: name.trim(), address: joinAddress(address), coords: point.value });
      } catch (err) {
        // Nothing was saved: back to the form with the reason, everything they typed intact.
        setProblem(err instanceof ApiError && err.kind === "client" ? `We couldn't save your details: ${err.message}` : errorMessage(err));
        setStep("details");
        return;
      }
      await Promise.all([clearDraft(user.uid), clearOnboardingSkipped(user.uid)]);
      await verify();
    });

  /** After a failed check: only the check again (the details are already saved). */
  const retryCheck = () =>
    once(async () => {
      setProblem(null);
      setStep("verifying");
      await verify();
    });

  const requestToJoin = () =>
    once(async () => {
      if (!selectedHoodId) return;
      setProblem(null);
      setBusy("requesting");
      try {
        await requestHood(user, selectedHoodId);
        setStep("requested");
      } catch (err) {
        setProblem(errorMessage(err));
      } finally {
        setBusy(null);
      }
    });

  /** Into the app: reload the profile so the session sees the new Hood (or the pending request). */
  const finish = () =>
    once(async () => {
      setProblem(null);
      setBusy("leaving");
      try {
        if (await refreshProfile()) setFinished(true);
        else setProblem("We couldn't load your account just now. Check your connection and try again.");
      } finally {
        setBusy(null);
      }
    });

  return {
    step,
    name,
    address,
    point,
    locate,
    errors,
    problem,
    preview,
    previewError,
    milestone,
    busy,
    nearby,
    selectedHoodId,
    joinedHood,
    finished,
    editName,
    editAddress,
    forgetLocation,
    locateMe,
    toConfirm,
    backToDetails,
    confirm,
    retryCheck,
    retryPreview: () => setPreviewNonce((n) => n + 1),
    selectHood: setSelectedHoodId,
    requestToJoin,
    finish,
  };
}

export type Onboarding = ReturnType<typeof useOnboarding>;
