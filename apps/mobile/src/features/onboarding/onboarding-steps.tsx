import { COVERAGE } from "@myhoodora/api-contract/coverage";
import { errorMessage } from "@myhoodora/api-contract/errors";
import { joinAddress } from "@myhoodora/api-contract/lookups";
import { Check, Hourglass, Lock, LocateFixed, MapPin, MapPinned, Pencil, ShieldCheck, Tag, ThumbsUp, TriangleAlert } from "lucide-react-native";
import { useRef, type ComponentType } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type TextInput } from "react-native";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { MascotLockup } from "@/shared/ui/brand";
import { Chip } from "@/shared/ui/chip";
import { InlineAlert } from "@/shared/ui/inline-alert";
import { Text } from "@/shared/ui/text";
import { TextField } from "@/shared/ui/text-field";
import { confirmAction, formatAccuracy, formatDistance, LOOSE_GPS_M } from "./onboarding-rules";
import type { Onboarding } from "./use-onboarding";

type IconType = ComponentType<{ size?: number; color?: string }>;

export function StepHeading({ title, body, centred = false }: { title: string; body?: string; centred?: boolean }) {
  const align = centred ? styles.centred : undefined;
  return (
    <View style={styles.heading}>
      <Text variant="title" style={[styles.title, align]}>
        {title}
      </Text>
      {body ? (
        <Text tone="muted" style={align}>
          {body}
        </Text>
      ) : null}
    </View>
  );
}

/** The web's PrivacyNote: said where the address is asked for, not buried in a policy. */
export function PrivacyNote() {
  const t = useTheme();
  return (
    <View style={[styles.note, { backgroundColor: t.colors.muted, borderRadius: t.radius.xl }]}>
      <Lock size={16} color={t.colors.primary} />
      <Text variant="caption" style={styles.flex}>
        Your address is private. Neighbours only ever see your neighbourhood&apos;s name.
      </Text>
    </View>
  );
}

/** A large round icon at the top of an outcome screen. */
function Badge({ Icon, tone = "primary" }: { Icon: IconType; tone?: "primary" | "warning" | "destructive" }) {
  const t = useTheme();
  const look = { primary: [tint(t.colors.primary), t.colors.primary], warning: [t.colors.warningSoft, t.colors.warning], destructive: [t.colors.dangerSoft, t.colors.destructive] }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: look[0] }]}>
      <Icon size={34} color={look[1]} />
    </View>
  );
}

// ── Step 1: name and address ────────────────────────────────────────────────

function LocateCard({ o }: { o: Onboarding }) {
  const t = useTheme();
  const { locate } = o;
  const found = locate.status === "found";
  const title = locate.status === "locating" ? "Finding your location…" : found ? "Location found" : "Use my current location";
  const detail =
    locate.status === "locating"
      ? "Allow location access if your phone asks."
      : found
        ? `We found you${locate.accuracyM ? ` (${formatAccuracy(locate.accuracyM)})` : ""}. Check your address below.`
        : locate.status === "failed"
          ? locate.message
          : "Fastest and most accurate, best done at home. We use it once, to find your neighbourhood.";
  return (
    <Pressable
      onPress={() => void o.locateMe()}
      disabled={locate.status === "locating"}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={detail}
      accessibilityState={{ busy: locate.status === "locating" }}
      style={({ pressed }) => [
        styles.locate,
        { borderColor: found ? t.colors.primary : t.colors.border, backgroundColor: pressed || found ? tint(t.colors.primary, 0.06) : t.colors.card, borderRadius: t.radius["2xl"] },
      ]}
    >
      <View style={[styles.locateIcon, { backgroundColor: t.colors.primary }]}>
        {locate.status === "locating" ? <ActivityIndicator color={t.colors.primaryForeground} /> : <LocateFixed size={22} color={t.colors.primaryForeground} />}
      </View>
      <View style={styles.flex} accessibilityLiveRegion="polite">
        <Text variant="label" style={styles.locateTitle}>
          {title}
        </Text>
        <Text variant="caption" tone={locate.status === "failed" ? "default" : "muted"}>
          {detail}
        </Text>
      </View>
      {found ? <Check size={20} color={t.colors.primary} /> : null}
    </Pressable>
  );
}

function OrRule({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View style={styles.rule}>
      <View style={[styles.line, { backgroundColor: t.colors.border }]} />
      <Text variant="caption" tone="muted" style={styles.ruleText}>
        {label}
      </Text>
      <View style={[styles.line, { backgroundColor: t.colors.border }]} />
    </View>
  );
}

export function DetailsStep({ o }: { o: Onboarding }) {
  const streetRef = useRef<TextInput>(null);
  const areaRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const gpsKept = o.point?.source === "gps";
  const typedCity = o.address.city.trim().toLowerCase();
  return (
    <>
      <StepHeading title="Let's find your neighbourhood" body="Tell us your name and where you live, and we'll connect you with verified neighbours nearby." />
      {o.problem ? <InlineAlert>{o.problem}</InlineAlert> : null}
      <TextField
        label="Your name"
        placeholder="e.g. Adaeze Okafor"
        value={o.name}
        onChangeText={o.editName}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={() => streetRef.current?.focus()}
        hint="Use the name your neighbours know you by."
        error={o.errors?.name}
        maxLength={60}
      />
      <View style={styles.group}>
        <Text variant="label">Where do you live?</Text>
        <LocateCard o={o} />
        <OrRule label={gpsKept ? "CHECK IT" : "OR TYPE IT"} />
        <TextField
          ref={streetRef}
          label="House number and street"
          placeholder="e.g. 12 Admiralty Way"
          value={o.address.street}
          onChangeText={(street) => o.editAddress({ street })}
          autoComplete="address-line1"
          textContentType="streetAddressLine1"
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => areaRef.current?.focus()}
          error={o.errors?.street}
          maxLength={100}
        />
        <TextField
          ref={areaRef}
          label="Area or estate"
          placeholder="e.g. Lekki Phase 1"
          value={o.address.area}
          onChangeText={(area) => o.editAddress({ area })}
          autoComplete="address-line2"
          textContentType="sublocality"
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => cityRef.current?.focus()}
          hint="Many streets share a name. This tells us which is yours."
          error={o.errors?.area}
          maxLength={100}
        />
        <TextField
          ref={cityRef}
          label="City"
          placeholder="e.g. Lagos"
          value={o.address.city}
          onChangeText={(city) => o.editAddress({ city })}
          autoComplete="postal-address-locality"
          textContentType="addressCity"
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={() => void o.toConfirm()}
          error={o.errors?.city}
          maxLength={100}
        />
        {/* The cities we're live in, one tap away (the web offers them as suggestions). */}
        <View style={styles.chips} accessibilityLabel="Cities we're live in">
          {COVERAGE.map((c) => (
            <Chip key={c.city} label={c.city} selected={typedCity === c.city.toLowerCase()} onPress={() => o.editAddress({ city: c.city })} />
          ))}
        </View>
        {gpsKept ? (
          <Text variant="caption" tone="muted">
            We&apos;ll match you using the location we found. Not at home right now?{" "}
            <Text variant="caption" tone="primary" onPress={o.forgetLocation} accessibilityRole="button" style={styles.link}>
              Find the address above instead
            </Text>
          </Text>
        ) : null}
      </View>
      <PrivacyNote />
    </>
  );
}

// ── Step 2: check the neighbourhood before joining ──────────────────────────

function Verdict({ o }: { o: Onboarding }) {
  const t = useTheme();
  if (o.previewError) {
    return (
      <InlineAlert action={<Text variant="label" tone="primary" onPress={o.retryPreview} accessibilityRole="button">Try again</Text>}>
        {errorMessage(o.previewError)}
      </InlineAlert>
    );
  }
  if (!o.preview) {
    return (
      <View style={styles.checking} accessibilityLiveRegion="polite">
        <ActivityIndicator color={t.colors.primary} />
        <Text tone="muted">Checking which neighbourhood this is…</Text>
      </View>
    );
  }
  const { hood, nearbyHoods, cannotJoin } = o.preview;
  if (hood) {
    return (
      <View style={[styles.verdict, { backgroundColor: cannotJoin ? t.colors.warningSoft : tint(t.colors.primary, 0.08), borderColor: cannotJoin ? t.colors.warning : t.colors.primary, borderWidth: 1.5, borderRadius: t.radius["2xl"] }]} accessibilityLiveRegion="polite">
        <ShieldCheck size={22} color={cannotJoin ? t.colors.warning : t.colors.primary} />
        <View style={styles.flex}>
          <Text variant="caption" tone="muted">
            This address is in
          </Text>
          <Text variant="title">{hood.name}</Text>
          <Text variant="caption" tone="muted">
            {hood.city}
          </Text>
          <Text variant="caption" style={styles.verdictNote}>
            {cannotJoin ?? "Not your neighbourhood? Edit your address, or use your current location at home."}
          </Text>
        </View>
      </View>
    );
  }
  const [closest] = nearbyHoods;
  return (
    <View style={[styles.verdict, { backgroundColor: t.colors.muted, borderRadius: t.radius["2xl"] }]} accessibilityLiveRegion="polite">
      <MapPinned size={22} color={t.colors.mutedForeground} />
      <Text style={styles.flex}>
        {closest
          ? `This address is just outside our neighbourhoods. The closest is ${closest.name} (${formatDistance(closest.distanceMeters)}), and you can ask to join it next.`
          : "This address isn't in one of our neighbourhoods yet. You can still join with limited access."}
      </Text>
    </View>
  );
}

export function ConfirmStep({ o }: { o: Onboarding }) {
  const t = useTheme();
  const source = o.point?.source ?? null;
  return (
    <>
      <StepHeading title="Is this your neighbourhood?" body="It decides whose posts you see and who you can message, so check it before you join." />
      {o.problem ? <InlineAlert>{o.problem}</InlineAlert> : null}
      <View style={[styles.addressRow, { borderColor: t.colors.border, borderRadius: t.radius["2xl"], backgroundColor: t.colors.card }]}>
        <MapPin size={20} color={t.colors.primary} />
        <View style={styles.flex}>
          <Text variant="label">Your address</Text>
          <Text variant="caption" tone="muted">
            {joinAddress(o.address)}
          </Text>
        </View>
        <Pressable onPress={o.backToDetails} accessibilityRole="button" accessibilityLabel="Edit your address" hitSlop={10} style={styles.edit}>
          <Pencil size={14} color={t.colors.primary} />
          <Text variant="label" tone="primary">
            Edit
          </Text>
        </Pressable>
      </View>
      {source === "area" ? (
        <InlineAlert
          tone="warning"
          action={
            <Text variant="label" tone="primary" onPress={() => void o.locateMe()} accessibilityRole="button">
              {o.locate.status === "locating" ? "Finding your location…" : "Use my current location"}
            </Text>
          }
        >
          {`We couldn't find ${o.address.street.trim() || "your street"} in ${o.address.area.trim() || "your area"}, so we can't tell which neighbourhood your home is in. Use your current location (best at home), or edit the street name.`}
        </InlineAlert>
      ) : (
        <>
          {o.locate.status === "failed" ? <InlineAlert tone="warning">{o.locate.message}</InlineAlert> : null}
          {source === "gps" && o.point?.accuracyM && o.point.accuracyM > LOOSE_GPS_M ? (
            <InlineAlert tone="info">{`Your phone placed you ${formatAccuracy(o.point.accuracyM)}. If the neighbourhood below isn't yours, try again at home or edit your address.`}</InlineAlert>
          ) : null}
          <Verdict o={o} />
        </>
      )}
      <PrivacyNote />
    </>
  );
}

/** The label of step 2's main button, and whether it can be pressed. */
export function confirmButton(o: Onboarding): { label: string; enabled: boolean } {
  if (o.point?.source === "area") return { label: "Find your home first", enabled: false };
  if (!o.preview) return { label: "Checking…", enabled: false };
  const action = confirmAction(o.preview, o.point?.source ?? null);
  if (action.kind === "join") return { label: `Yes, join ${action.hoodName}`, enabled: true };
  if (action.kind === "blocked") return { label: "You can't join yet", enabled: false };
  return { label: "Continue", enabled: true };
}

// ── Step 3: saving and checking ─────────────────────────────────────────────

function CheckItem({ label, state }: { label: string; state: "waiting" | "active" | "done" }) {
  const t = useTheme();
  return (
    <View style={styles.checkItem} accessible accessibilityLabel={`${label}: ${state === "done" ? "done" : state === "active" ? "in progress" : "waiting"}`}>
      <View style={[styles.checkDot, { backgroundColor: state === "done" ? t.colors.primary : state === "active" ? tint(t.colors.primary) : t.colors.muted }]}>
        {state === "done" ? <Check size={14} color={t.colors.primaryForeground} /> : state === "active" ? <ActivityIndicator size="small" color={t.colors.primary} /> : null}
      </View>
      <Text variant="label" tone={state === "waiting" ? "muted" : "default"}>
        {label}
      </Text>
    </View>
  );
}

export function VerifyingStep({ o }: { o: Onboarding }) {
  const t = useTheme();
  const saving = o.milestone === "saving";
  return (
    <View style={styles.centre}>
      <Badge Icon={ShieldCheck} />
      <StepHeading centred title="Joining your neighbourhood" body="This only takes a moment." />
      <View style={[styles.checklist, { borderColor: t.colors.border, borderRadius: t.radius["2xl"], backgroundColor: t.colors.card }]} accessibilityLiveRegion="polite">
        <CheckItem label="Saving your details" state={saving ? "active" : "done"} />
        <CheckItem label="Matching you to a neighbourhood" state={saving ? "waiting" : "active"} />
      </View>
    </View>
  );
}

// ── Outcomes ────────────────────────────────────────────────────────────────

const FIRST_THINGS: { Icon: IconType; title: string; body: string }[] = [
  { Icon: TriangleAlert, title: "Safety alerts", body: "Security, power and flooding updates from your street." },
  { Icon: ThumbsUp, title: "Trusted recommendations", body: "Artisans, tailors and schools neighbours vouch for." },
  { Icon: Tag, title: "For sale and free", body: "Good deals and giveaways from people nearby." },
];

export function JoinedStep({ o }: { o: Onboarding }) {
  const t = useTheme();
  return (
    <View style={styles.centre} accessibilityLiveRegion="polite">
      <MascotLockup height={110} />
      <StepHeading centred title={`Welcome to ${o.joinedHood ?? "your neighbourhood"}!`} body="You're a verified neighbour. Here's what's waiting for you:" />
      <View style={styles.things}>
        {FIRST_THINGS.map(({ Icon, title, body }) => (
          <View key={title} style={[styles.thing, { backgroundColor: t.colors.card, borderColor: t.colors.border, borderRadius: t.radius["2xl"] }]}>
            <View style={[styles.thingIcon, { backgroundColor: tint(t.colors.primary) }]}>
              <Icon size={20} color={t.colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text variant="label">{title}</Text>
              <Text variant="caption" tone="muted">
                {body}
              </Text>
            </View>
          </View>
        ))}
      </View>
      {o.problem ? <InlineAlert>{o.problem}</InlineAlert> : null}
    </View>
  );
}

export function NearbyStep({ o }: { o: Onboarding }) {
  const t = useTheme();
  const only = o.nearby.length === 1 ? o.nearby[0] : null;
  return (
    <>
      <View style={styles.centre}>
        <Badge Icon={MapPinned} />
        <StepHeading
          centred
          title="You're close to a neighbourhood"
          body={
            only
              ? `Your address isn't inside one of our neighbourhoods yet, but you're near ${only.name}. Would you like to join?`
              : "Your address isn't inside one of our neighbourhoods yet, but you're near these. Choose the one you'd like to join."
          }
        />
      </View>
      {o.problem ? <InlineAlert>{o.problem}</InlineAlert> : null}
      <View accessibilityRole="radiogroup" style={styles.group}>
        {o.nearby.map((h, i) => {
          const checked = h.id === o.selectedHoodId;
          return (
            <Pressable
              key={h.id}
              onPress={() => o.selectHood(h.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              accessibilityLabel={`${h.name}, ${h.city}, ${formatDistance(h.distanceMeters)}`}
              style={[styles.option, { borderColor: checked ? t.colors.primary : t.colors.border, backgroundColor: checked ? tint(t.colors.primary, 0.06) : t.colors.card, borderRadius: t.radius["2xl"] }]}
            >
              <View style={[styles.radio, { borderColor: checked ? t.colors.primary : t.colors.mutedForeground, backgroundColor: checked ? t.colors.primary : "transparent" }]}>
                {checked ? <Check size={12} color={t.colors.primaryForeground} /> : null}
              </View>
              <View style={styles.flex}>
                <Text variant="label">{h.name}</Text>
                <Text variant="caption" tone="muted">
                  {h.city} · {formatDistance(h.distanceMeters)}
                </Text>
              </View>
              {i === 0 && o.nearby.length > 1 ? (
                <View style={[styles.pill, { backgroundColor: tint(t.colors.primary) }]}>
                  <Text variant="caption" tone="primary">
                    Closest
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <InlineAlert tone="info">
        To keep neighbourhoods local, our team reviews requests from just outside a neighbourhood. We&apos;ll let you know once it&apos;s approved. Until then you can browse with limited access.
      </InlineAlert>
    </>
  );
}

export function RequestedStep({ o }: { o: Onboarding }) {
  const hood = o.nearby.find((h) => h.id === o.selectedHoodId)?.name ?? "the neighbourhood";
  return (
    <View style={styles.centre} accessibilityLiveRegion="polite">
      <Badge Icon={Hourglass} />
      <StepHeading
        centred
        title={`Request sent to ${hood}`}
        body="We'll send you a notification once our team has reviewed it. Until then you can browse with limited access: alerts, events, groups and For Sale & Free unlock when you're approved."
      />
      {o.problem ? <InlineAlert>{o.problem}</InlineAlert> : null}
    </View>
  );
}

export function OutsideStep({ o }: { o: Onboarding }) {
  const t = useTheme();
  return (
    <>
      <View style={styles.centre}>
        <Badge Icon={MapPin} tone="warning" />
        <StepHeading centred title="We're not in your area yet" body="Your details are saved. We're opening new neighbourhoods as residents join. Here's where we're live today:" />
      </View>
      <View style={[styles.checklist, { borderColor: t.colors.border, borderRadius: t.radius["2xl"], backgroundColor: t.colors.card }]}>
        {COVERAGE.map((c) => (
          <View key={c.city}>
            <Text variant="label">{c.city}</Text>
            <Text variant="caption" tone="muted">
              {c.areas.join(" · ")}
            </Text>
          </View>
        ))}
      </View>
      <Text variant="caption" tone="muted" style={styles.centred}>
        Live in one of these? Your address may be slightly off. Try editing it, or use your current location at home.
      </Text>
      {o.problem ? <InlineAlert>{o.problem}</InlineAlert> : null}
    </>
  );
}

export function FailedStep({ o }: { o: Onboarding }) {
  return (
    <>
      <View style={styles.centre}>
        <Badge Icon={TriangleAlert} tone="destructive" />
        <StepHeading
          centred
          title="We couldn't check your location"
          body="Your details are saved. This was just the location check, usually a connection problem. Try again, or continue and verify later."
        />
      </View>
      {o.problem ? <InlineAlert>{o.problem}</InlineAlert> : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  heading: { gap: 6 },
  title: { fontSize: 26, lineHeight: 32 },
  group: { gap: 12 },
  note: { flexDirection: "row", gap: 10, padding: 12, alignItems: "flex-start" },
  badge: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  locate: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1.5, minHeight: MIN_TOUCH + 24 },
  locateIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  locateTitle: { fontSize: 16 },
  rule: { flexDirection: "row", alignItems: "center", gap: 10 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  ruleText: { fontSize: 12, letterSpacing: 0.6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: -4 },
  link: { textDecorationLine: "underline" },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1 },
  edit: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: MIN_TOUCH, paddingHorizontal: 4 },
  checking: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16 },
  verdict: { flexDirection: "row", gap: 12, padding: 16, alignItems: "flex-start" },
  verdictNote: { marginTop: 6 },
  centre: { gap: 18, alignItems: "stretch" },
  centred: { textAlign: "center" },
  checklist: { borderWidth: 1, padding: 16, gap: 14 },
  checkItem: { flexDirection: "row", alignItems: "center", gap: 12 },
  checkDot: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  things: { gap: 10 },
  thing: { flexDirection: "row", gap: 12, padding: 14, borderWidth: 1, alignItems: "center" },
  thingIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  option: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderWidth: 1.5, minHeight: MIN_TOUCH + 16 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
});
