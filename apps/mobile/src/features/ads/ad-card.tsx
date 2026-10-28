import type { AdMedia, FeedAd } from "@myhoodora/api-contract/ads";
import { useQueryClient } from "@tanstack/react-query";
import { useEvent } from "expo";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView, type VideoPlayer } from "expo-video";
import { Ellipsis, EyeOff, Flag, Info, Volume2, VolumeX } from "lucide-react-native";
import { memo, useEffect, useState } from "react";
import { Alert, FlatList, Linking, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { hideAd, isAd, reportAd, updateFeedEntries, type AdEntry } from "@/features/feed/feed-api";
import { ReportSheet } from "@/features/feed/report-sheet";
import { SeeMoreText } from "@/features/feed/see-more-text";
import { accent } from "@/shared/theme/accents";
import { MIN_TOUCH, tint, useTheme, type Theme } from "@/shared/theme/theme";
import { ActionSheet } from "@/shared/ui/action-sheet";
import { Avatar } from "@/shared/ui/avatar";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { sizedImage } from "@/shared/utils/media";
import { adTracker } from "./ad-tracking";

/** Lines of ad text before "See more" (Meta's guidance: about 125 characters). */
const AD_LINES = 3;

const clampAspect = (aspect: number | undefined, min: number, max: number) => Math.min(max, Math.max(min, aspect ?? 1));
const domainOf = (url?: string) => {
  const m = url ? /^https?:\/\/(?:www\.)?([^/?#]+)/i.exec(url) : null;
  return m?.[1];
};

/**
 * A sponsored item in the feed (contract §32): the same card shape as a post, so it sits naturally,
 * but plainly marked "Sponsored" under the advertiser's name. Tapping the button, the media or the
 * advertiser counts as a click and opens the link (or dials, for "Call"). The ⋯ menu hides it,
 * explains why it's shown, or reports it. `active`: on screen now (videos play only then).
 */
export const AdCard = memo(function AdCard({ entry, session, active }: { entry: AdEntry; session: string; active: boolean }) {
  const t = useTheme();
  const user = useSignedInUser();
  const client = useQueryClient();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const ad = entry.ad;

  // Every interaction is counted (once per feed session and kind): the admin sees it in the ad's results.
  const track = (type: "video_play" | "unmute" | "swipe" | "why") => adTracker.track(user, { adId: ad._id, type, sessionId: session });
  const open = (url?: string) => {
    adTracker.track(user, { adId: ad._id, type: "click", sessionId: session });
    const target = ad.cta?.type === "call" && ad.cta.phone && !url ? `tel:${ad.cta.phone}` : (url ?? ad.cta?.url);
    if (target) void Linking.openURL(target).catch(() => toast("That link couldn't be opened.", "error"));
  };
  // Gone from every feed at once; the API makes it permanent.
  const removeHere = () => updateFeedEntries(client, (entries) => entries.filter((e) => !(isAd(e) && e.ad._id === ad._id)));
  const hide = () => {
    removeHere();
    toast("Ad hidden. You won't see it again.");
    void hideAd(user, ad._id, session).catch(() => undefined);
  };

  const announcement = ad.format === "announcement";
  return (
    <View style={[styles.card, { backgroundColor: t.colors.card }]} accessibilityLabel={`Sponsored by ${ad.advertiser.name}`}>
      <View style={styles.header}>
        <Pressable onPress={() => open()} accessibilityRole="link" accessibilityHint="Opens the advertiser's link" style={({ pressed }) => [styles.who, { opacity: pressed ? 0.7 : 1 }]}>
          {ad.advertiser.logoUrl ? (
            <Image source={{ uri: sizedImage(ad.advertiser.logoUrl, 40) }} style={[styles.logo, { backgroundColor: t.colors.muted }]} contentFit="cover" accessibilityIgnoresInvertColors />
          ) : (
            <Avatar name={ad.advertiser.name} size={40} />
          )}
          <View style={styles.shrink}>
            <Text variant="label" style={styles.name} numberOfLines={1}>
              {ad.advertiser.name}
            </Text>
            <Text variant="caption" tone="muted">
              Sponsored
            </Text>
          </View>
        </Pressable>
        <Pressable onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="Ad options" hitSlop={8} style={({ pressed }) => [styles.iconAction, pressed && { backgroundColor: t.colors.muted }]}>
          <Ellipsis size={20} color={t.colors.mutedForeground} />
        </Pressable>
      </View>

      {announcement ? (
        <Announcement ad={ad} theme={t} />
      ) : ad.primaryText ? (
        <View style={styles.body}>
          <SeeMoreText id={`ad:${entry.slotId}`} text={ad.primaryText} lines={AD_LINES} style={styles.text} />
        </View>
      ) : null}

      {ad.format === "carousel" ? <Carousel ad={ad} onOpen={open} onSwipe={() => track("swipe")} /> : null}
      {(ad.format === "image" || ad.format === "business") && ad.media[0] ? <AdImage media={ad.media[0]} onPress={() => open()} /> : null}
      {ad.format === "video" && ad.media[0] ? <AdVideo media={ad.media[0]} active={active} onPress={() => open()} onPlay={() => track("video_play")} onUnmute={() => track("unmute")} /> : null}

      {ad.cta && ad.format !== "carousel" ? (
        <View style={[styles.ctaBar, { backgroundColor: announcement ? "transparent" : t.colors.muted }]}>
          <View style={styles.shrink}>
            {ad.headline ? (
              <Text variant="label" numberOfLines={1}>
                {ad.headline}
              </Text>
            ) : null}
            {ad.cta.type === "call" ? (
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {ad.cta.phone}
              </Text>
            ) : domainOf(ad.cta.url) ? (
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {domainOf(ad.cta.url)}
              </Text>
            ) : null}
          </View>
          <Pressable onPress={() => open()} accessibilityRole="button" style={({ pressed }) => [styles.ctaButton, { backgroundColor: tint(t.colors.primary, pressed ? 0.25 : 0.14) }]}>
            <Text variant="label" tone="primary">
              {ad.cta.label}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        label="Ad options"
        groups={[
          [
            { key: "hide", label: "Hide ad", hint: "You won't see this ad again", Icon: EyeOff, onPress: hide },
            {
              key: "why",
              label: "Why am I seeing this?",
              Icon: Info,
              onPress: () => {
              track("why");
              setTimeout(() => Alert.alert("Why you're seeing this ad", ad.why), 350);
            },
          },
          ],
          [{ key: "report", label: "Report ad", hint: "Private: the advertiser isn't told who", Icon: Flag, onPress: () => setTimeout(() => setReporting(true), 350) }],
        ]}
      />
      <ReportSheet
        visible={reporting}
        onClose={() => setReporting(false)}
        targetType="ad"
        targetId={ad._id}
        send={async (reason) => {
          await reportAd(user, ad._id, reason, session);
          removeHere();
        }}
      />
    </View>
  );
});

/** Text on a coloured panel: notices from the community team. */
function Announcement({ ad, theme }: { ad: FeedAd; theme: Theme }) {
  const [bg, fg] = accent(ad.background, theme.scheme);
  return (
    <View style={[styles.announcement, { backgroundColor: bg }]}>
      <Text style={[styles.announcementText, { color: fg }]}>{ad.primaryText}</Text>
    </View>
  );
}

function AdImage({ media, onPress }: { media: AdMedia; onPress: () => void }) {
  const { width } = useWindowDimensions();
  // Square or portrait reads best in the feed (§5.1); anything wider is shown no wider than 1.91:1.
  const aspect = clampAspect(media.aspect, 0.8, 1.91);
  return (
    <Pressable onPress={onPress} accessibilityRole="imagebutton" accessibilityLabel="Ad image. Opens the advertiser's link">
      <Image source={{ uri: sizedImage(media.url, width) }} style={{ width, height: width / aspect }} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
    </Pressable>
  );
}

/**
 * Plays muted, looping, only while it's on screen (§5.1); the poster shows until the first frame.
 * The speaker button turns the sound on. Tapping the video opens the advertiser's link.
 */
function AdVideo({ media, active, onPress, onPlay, onUnmute }: { media: AdMedia; active: boolean; onPress: () => void; onPlay: () => void; onUnmute: () => void }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const aspect = clampAspect(media.aspect, 0.8, 1.78);
  const [ready, setReady] = useState(false);
  const player = useVideoPlayer(media.url, (p) => {
    p.muted = true;
    p.loop = true;
  });
  const { muted } = useEvent(player, "mutedChange", { muted: player.muted });
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });
  useEffect(() => {
    if (isPlaying) onPlay();
  }, [isPlaying, onPlay]);
  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);
  return (
    <View style={{ width, height: width / aspect, backgroundColor: t.colors.muted }}>
      <Pressable onPress={onPress} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Ad video. Opens the advertiser's link">
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} surfaceType="textureView" onFirstFrameRender={() => setReady(true)} />
        {!ready && media.posterUrl ? <Image source={{ uri: sizedImage(media.posterUrl, width) }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
      </Pressable>
      <Pressable
        onPress={() => {
          if (player.muted) onUnmute();
          toggleSound(player);
        }}
        accessibilityRole="button"
        accessibilityLabel={muted ? "Turn sound on" : "Turn sound off"}
        hitSlop={8}
        style={styles.mute}
      >
        {muted ? <VolumeX size={18} color="#fff" /> : <Volume2 size={18} color="#fff" />}
      </Pressable>
    </View>
  );
}

function toggleSound(player: VideoPlayer) {
  player.muted = !player.muted;
}

/** 2–10 square cards to swipe through, each with its own headline and link. */
function Carousel({ ad, onOpen, onSwipe }: { ad: FeedAd; onOpen: (url: string) => void; onSwipe: () => void }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const cardWidth = Math.round(width * 0.72);
  return (
    <FlatList
      horizontal
      data={ad.cards}
      keyExtractor={(c, i) => `${i}:${c.imageUrl}`}
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + 8}
      decelerationRate="fast"
      onMomentumScrollEnd={(e) => e.nativeEvent.contentOffset.x > 0 && onSwipe()}
      contentContainerStyle={styles.carousel}
      renderItem={({ item }) => (
        <Pressable onPress={() => onOpen(item.url)} accessibilityRole="link" accessibilityLabel={`${item.headline}. Opens the link`} style={[styles.carouselCard, { width: cardWidth, borderColor: t.colors.border, backgroundColor: t.colors.card }]}>
          <Image source={{ uri: sizedImage(item.imageUrl, cardWidth) }} style={{ width: cardWidth, height: cardWidth }} contentFit="cover" accessibilityIgnoresInvertColors />
          <View style={styles.carouselFoot}>
            <Text variant="label" numberOfLines={1} style={styles.shrink}>
              {item.headline}
            </Text>
            {ad.cta ? (
              <Text variant="caption" tone="primary">
                {ad.cta.label}
              </Text>
            ) : null}
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: { paddingTop: 12, paddingBottom: 12, gap: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingLeft: 16, paddingRight: 8 },
  who: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  logo: { width: 40, height: 40, borderRadius: 20 },
  name: { fontSize: 16 },
  shrink: { flexShrink: 1 },
  iconAction: { width: MIN_TOUCH - 4, height: MIN_TOUCH - 4, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 16 },
  text: { fontSize: 16, lineHeight: 23 },
  announcement: { marginHorizontal: 16, borderRadius: 16, padding: 18 },
  announcementText: { fontSize: 18, lineHeight: 26 },
  ctaBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 10, marginTop: -10 },
  ctaButton: { borderRadius: 10, paddingHorizontal: 14, minHeight: 38, alignItems: "center", justifyContent: "center" },
  mute: { position: "absolute", right: 12, bottom: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  carousel: { paddingHorizontal: 16, gap: 8 },
  carouselCard: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  carouselFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, padding: 10 },
});
