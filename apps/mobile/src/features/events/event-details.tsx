import { errorMessage } from "@myhoodora/api-contract/errors";
import type { ApiPost, EventRsvpSummary, RsvpStatus } from "@myhoodora/api-contract/types";
import { useQueryClient } from "@tanstack/react-query";
import { eventCalendar } from "@myhoodora/api-contract/calendar";
import { CalendarDays, CalendarPlus, Check, MapPin, Star } from "lucide-react-native";
import { useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { config } from "@/core/config/env";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { signal } from "@/features/feedback/engagement";
import { updatePostEverywhere } from "@/features/feed/use-reaction";
import { addToCalendar } from "./add-to-calendar";
import { dateBadge, eventPhase, eventTitle, eventWhen, isPastEvent, PHASE_LABEL } from "./event-time";
import { setRsvp, withRsvp } from "./events-api";

const emptyRsvp = (postId: string): EventRsvpSummary => ({ postId, goingCount: 0, interestedCount: 0, myStatus: null });

/** The calendar page: month in coral, the day big, the weekday under it. */
export function DateBadge({ iso }: { iso?: string }) {
  const t = useTheme();
  const b = iso ? dateBadge(iso) : null;
  if (!b) {
    // Posted before events needed a date: a plain calendar, not a made-up one.
    return (
      <View style={[styles.badge, { borderColor: t.colors.border, backgroundColor: t.colors.muted }]} accessible={false}>
        <CalendarDays size={24} color={t.colors.mutedForeground} />
        <Text variant="caption" tone="muted">
          No date
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, { borderColor: t.colors.border, backgroundColor: t.colors.card }]} accessible={false}>
      <Text style={[styles.month, { color: t.colors.destructive, fontFamily: t.fonts.bold }]}>{b.month}</Text>
      <Text style={[styles.day, { color: t.colors.foreground, fontFamily: t.fonts.bold }]}>{b.day}</Text>
      <Text variant="caption" tone="muted">
        {b.weekday}
      </Text>
    </View>
  );
}

/** "Today" / "Happening now" / "Ended", when it applies. */
export function PhaseChip({ iso }: { iso?: string }) {
  const t = useTheme();
  const phase = eventPhase(iso);
  const label = PHASE_LABEL[phase];
  if (!label) return null;
  const tone = phase === "live" ? t.colors.success : phase === "today" ? t.colors.primary : t.colors.mutedForeground;
  return (
    <View style={[styles.chip, { backgroundColor: tint(tone, 0.12) }]}>
      {phase === "live" ? <View style={[styles.liveDot, { backgroundColor: tone }]} /> : null}
      <Text variant="caption" style={{ color: tone, fontFamily: t.fonts.semibold }}>
        {label}
      </Text>
    </View>
  );
}

/** When and where, beside the calendar page. `title` for lists, where the post text isn't shown. */
export function EventFacts({ post, title }: { post: ApiPost; title?: string }) {
  const t = useTheme();
  return (
    <View style={styles.facts}>
      <DateBadge iso={post.eventDate} />
      <View style={[styles.flex, styles.lines]}>
        {title ? (
          <Text variant="label" style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
        {post.eventDate ? (
          <View style={styles.line}>
            <CalendarDays size={15} color={t.colors.mutedForeground} />
            <Text variant="caption" style={styles.flexShrink}>
              {eventWhen(post.eventDate)}
            </Text>
            <PhaseChip iso={post.eventDate} />
          </View>
        ) : (
          <View style={styles.line}>
            <CalendarDays size={15} color={t.colors.mutedForeground} />
            <Text variant="caption" tone="muted" style={styles.flexShrink}>
              The host didn&apos;t set a date
            </Text>
          </View>
        )}
        {post.eventLocation ? (
          <View style={styles.line}>
            <MapPin size={15} color={t.colors.mutedForeground} />
            <Text variant="caption" style={styles.flexShrink} numberOfLines={2}>
              {post.eventLocation}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Going · Interested, each with its count; tap again to take it back. Shows at once, then settles to
 * the API's numbers. After the event: "This event has ended · 12 went".
 */
export function RsvpBar({ post }: { post: ApiPost }) {
  const t = useTheme();
  const user = useSignedInUser();
  const client = useQueryClient();
  const toast = useToast();
  const sending = useRef(false);
  const s = post.rsvp ?? emptyRsvp(post._id);
  // An undated event from before dates were required closes two weeks after it was posted.
  const ended = s.ended || eventPhase(post.eventDate) === "ended" || (!post.eventDate && isPastEvent(post));

  if (ended) {
    return (
      <Text variant="caption" tone="muted" style={styles.ended}>
        This event has ended{s.goingCount ? ` · ${s.goingCount} went` : ""}
      </Text>
    );
  }

  const choose = async (status: RsvpStatus) => {
    if (sending.current) return;
    sending.current = true;
    const before = s;
    const next = s.myStatus === status ? null : status;
    updatePostEverywhere(client, post._id, (p) => ({ ...p, rsvp: withRsvp(p.rsvp ?? before, next) }));
    try {
      const fresh = await setRsvp(user, post._id, next);
      updatePostEverywhere(client, post._id, (p) => ({ ...p, rsvp: fresh }));
      if (next) signal(user, "event_rsvp", post._id);
      if (next === "going") toast("You're going. We'll remind you before it starts.");
    } catch (err) {
      updatePostEverywhere(client, post._id, (p) => ({ ...p, rsvp: before }));
      toast(errorMessage(err), "error");
    } finally {
      sending.current = false;
    }
  };

  const options: { status: RsvpStatus; label: string; count: number; Icon: typeof Check }[] = [
    { status: "going", label: "Going", count: s.goingCount, Icon: Check },
    { status: "interested", label: "Interested", count: s.interestedCount, Icon: Star },
  ];
  return (
    <View style={styles.rsvpArea}>
    <View style={styles.rsvp} accessibilityRole="radiogroup" accessibilityLabel="Are you going?">
      {options.map(({ status, label, count, Icon }) => {
        const on = s.myStatus === status;
        return (
          <Pressable
            key={status}
            onPress={() => void choose(status)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${label}, ${count}`}
            accessibilityHint={on ? "Tap again to take it back" : undefined}
            style={({ pressed }) => [styles.rsvpButton, { backgroundColor: on ? t.colors.primary : tint(t.colors.primary, 0.08), borderColor: on ? t.colors.primary : tint(t.colors.primary, 0.2), opacity: pressed ? 0.8 : 1 }]}
          >
            <Icon size={17} color={on ? t.colors.primaryForeground : t.colors.primary} fill={on && status === "interested" ? t.colors.primaryForeground : "transparent"} />
            <Text variant="label" style={{ color: on ? t.colors.primaryForeground : t.colors.primary }}>
              {label}
            </Text>
            {count ? (
              <Text variant="caption" style={{ color: on ? t.colors.primaryForeground : t.colors.mutedForeground }}>
                {count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
    {s.myStatus ? <AddToCalendar post={post} /> : null}
    </View>
  );
}

/** "Add to calendar", once you're going or interested: the phone's own new-event screen, filled in (Google Calendar's page without one). */
function AddToCalendar({ post }: { post: ApiPost }) {
  const t = useTheme();
  const toast = useToast();
  const { title, rest } = eventTitle(post.message ?? "");
  const entry = eventCalendar({ id: post._id, title, rest, eventDate: post.eventDate, eventLocation: post.eventLocation }, config().webUrl);
  if (!entry) return null;
  const add = async () => {
    if (!(await addToCalendar(entry))) toast("Couldn't open a calendar on this phone.", "error");
  };
  return (
    <Pressable
      onPress={() => void add()}
      accessibilityRole="button"
      accessibilityLabel="Add to calendar"
      accessibilityHint="Opens your calendar with this event filled in"
      hitSlop={6}
      style={({ pressed }) => [styles.calendar, { opacity: pressed ? 0.6 : 1 }]}
    >
      <CalendarPlus size={16} color={t.colors.primary} />
      <Text variant="label" tone="primary">
        Add to calendar
      </Text>
    </Pressable>
  );
}

/** In a post card: the facts and the RSVP buttons in one framed block. */
export function EventBlock({ post }: { post: ApiPost }) {
  const t = useTheme();
  return (
    <View style={[styles.block, { borderColor: t.colors.border, backgroundColor: tint(t.colors.info, 0.05) }]}>
      <EventFacts post={post} />
      <RsvpBar post={post} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  block: { marginHorizontal: 16, padding: 12, gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  facts: { flexDirection: "row", gap: 12 },
  lines: { gap: 5, justifyContent: "center" },
  title: { fontSize: 16 },
  line: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  badge: { width: 56, alignItems: "center", paddingVertical: 6, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  month: { fontSize: 11, lineHeight: 14, letterSpacing: 0.5 },
  day: { fontSize: 22, lineHeight: 26 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  rsvpArea: { gap: 4 },
  rsvp: { flexDirection: "row", gap: 8 },
  calendar: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: MIN_TOUCH - 8, alignSelf: "center", paddingHorizontal: 12 },
  rsvpButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: MIN_TOUCH, borderRadius: 12, borderWidth: 1 },
  ended: { textAlign: "center" },
});
