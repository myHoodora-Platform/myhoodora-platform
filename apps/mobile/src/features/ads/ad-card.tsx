import { PROMOTED_ITEMS_SHOWN, type AdMedia, type FeedAd, type PromotedListing } from "@myhoodora/api-contract/ads";
import { useQueryClient } from "@tanstack/react-query";
import { useEvent } from "expo";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView, type VideoPlayer } from "expo-video";
import { ArrowRight, Ellipsis, EyeOff, Flag, Info, Package, Volume2, VolumeX } from "lucide-react-native";
import { memo, useEffect, useState } from "react";
import {FlatList, Linking, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { hideAd, isAd, reportAd, updateFeedEntries, type AdEntry } from "@/features/feed/feed-api";
import { ReportSheet } from "@/features/feed/report-sheet";
import { SeeMoreText } from "@/features/feed/see-more-text";
import { accent } from "@/shared/theme/accents";
import { MIN_TOUCH, tint, useTheme, type Theme } from "@/shared/theme/theme";
import { ActionSheet } from "@/shared/ui/action-sheet";
import { Avatar } from "@/shared/ui/avatar";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { formatNaira } from "@/shared/utils/format";
import { sizedImage } from "@/shared/utils/media";
import { adTracker } from "./ad-tracking";
import { showDialog } from "@/shared/ui/dialog";

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
  const router = useRouter();

  // Every interaction is counted (once per feed session and kind): the admin sees it in the ad's results.
  const track = (type: "video_play" | "unmute" | "swipe" | "why") => adTracker.track(user, { adId: ad._id, type, sessionId: session });
  const open = (url?: string) => {
    adTracker.track(user, { adId: ad._id, type: "click", sessionId: session });
    // A seller's ad stays in the app: all of their items.
    if (ad.seller) {
      router.push({ pathname: "/for-sale/seller/[uid]", params: { uid: ad.seller.uid, name: ad.seller.name } });
      return;
    }
    const target = ad.cta?.type === "call" && ad.cta.phone && !url ? `tel:${ad.cta.phone}` : (url ?? ad.cta?.url);
    if (target) void Linking.openURL(target).catch(() => toast("That link couldn't be opened.", "error"));
  };
  /** One of a promoted seller's items: its listing, in the app. */
  const openItem = (id: string) => {
    adTracker.track(user, { adId: ad._id, type: "click", sessionId: session });
    router.push({ pathname: "/for-sale/[id]", params: { id } });
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
        <Pressable onPress={() => open()} accessibilityRole="link" accessibilityHint={ad.seller ? "Shows everything they're selling" : "Opens the advertiser's link"} style={({ pressed }) => [styles.who, { opacity: pressed ? 0.7 : 1 }]}>
          {ad.seller ? (
            <Avatar name={ad.seller.name} photoURL={ad.seller.photoURL} size={40} />
          ) : ad.advertiser.logoUrl ? (
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

      {ad.format === "listings" && ad.listings?.length ? (
        <SellerItems items={ad.listings} total={ad.listingsTotal ?? ad.listings.length} sellerName={ad.seller?.name ?? ad.advertiser.name} onOpen={openItem} onSeeAll={() => open()} onSwipe={() => track("swipe")} />
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
            {ad.seller ? (
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {(ad.listingsTotal ?? ad.listings?.length) === 1 ? "1 item for sale" : `${ad.listingsTotal ?? ad.listings?.length ?? 0} items for sale`}
              </Text>
            ) : ad.cta.type === "call" ? (
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
              setTimeout(() => showDialog("Why you're seeing this ad", ad.why), 350);
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

/**
 * A promoted seller's items (at most `PROMOTED_ITEMS_SHOWN`). One item: its photo, blurred, fills the
 * card and the item sits in the middle. Several: a slider with dots, ending in "See all" when the seller
 * has more than are shown. Each item opens its listing in the app.
 */
function SellerItems({ items, total, sellerName, onOpen, onSeeAll, onSwipe }: { items: PromotedListing[]; total: number; sellerName: string; onOpen: (id: string) => void; onSeeAll: () => void; onSwipe: () => void }) {
  const shown = items.slice(0, PROMOTED_ITEMS_SHOWN);
  if (shown.length === 1 && total <= 1) return <OneItem item={shown[0]!} onOpen={onOpen} />;
  return <ItemSlider items={shown} total={Math.max(total, shown.length)} sellerName={sellerName} onOpen={onOpen} onSeeAll={onSeeAll} onSwipe={onSwipe} />;
}

function OneItem({ item, onOpen }: { item: PromotedListing; onOpen: (id: string) => void }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const height = Math.round(Math.min(width * 0.82, 380));
  const tile = Math.round(Math.min(width * 0.54, 240));
  return (
    <View style={[styles.stage, { height, backgroundColor: tint(t.colors.primary, 0.08) }]}>
      {item.photoUrl ? (
        <>
          {/* A small copy is enough under a heavy blur. */}
          <Image source={{ uri: sizedImage(item.photoUrl, 160) }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={30} accessible={false} accessibilityIgnoresInvertColors />
          <View style={[StyleSheet.absoluteFill, styles.scrim]} />
        </>
      ) : null}
      <ItemTile item={item} width={tile} onOpen={onOpen} raised />
    </View>
  );
}

type Slide = { kind: "item"; item: PromotedListing } | { kind: "more" };

function ItemSlider({ items, total, sellerName, onOpen, onSeeAll, onSwipe }: { items: PromotedListing[]; total: number; sellerName: string; onOpen: (id: string) => void; onSeeAll: () => void; onSwipe: () => void }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  // Big enough to see the item, with the next one peeking in so it's clear you can slide.
  const card = Math.round(Math.min(width * 0.62, 280));
  const step = card + 10;
  const slides: Slide[] = [...items.map((item) => ({ kind: "item" as const, item })), ...(total > items.length ? [{ kind: "more" as const }] : [])];
  const [index, setIndex] = useState(0);
  return (
    <View style={styles.slider}>
      <FlatList
        horizontal
        data={slides}
        keyExtractor={(s) => (s.kind === "item" ? s.item._id : "see-all")}
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        onMomentumScrollEnd={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          const atEnd = contentOffset.x >= contentSize.width - layoutMeasurement.width - 4;
          setIndex(atEnd ? slides.length - 1 : Math.round(contentOffset.x / step));
          if (contentOffset.x > 0) onSwipe();
        }}
        contentContainerStyle={styles.sliderRow}
        renderItem={({ item: s }) =>
          s.kind === "item" ? (
            <ItemTile item={s.item} width={card} onOpen={onOpen} />
          ) : (
            <Pressable
              onPress={onSeeAll}
              accessibilityRole="link"
              accessibilityLabel={`See all ${total} items from ${sellerName}`}
              style={({ pressed }) => [styles.seeAll, { width: card, borderColor: t.colors.border, backgroundColor: tint(t.colors.primary, 0.08), opacity: pressed ? 0.85 : 1 }]}
            >
              <View style={[styles.seeAllIcon, { backgroundColor: t.colors.primary }]}>
                <ArrowRight size={22} color={t.colors.primaryForeground} />
              </View>
              <Text variant="label" tone="primary">
                See all {total} items
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                from {sellerName.split(" ")[0]}
              </Text>
            </Pressable>
          )
        }
      />
      {slides.length > 1 ? (
        <View style={styles.dots} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {slides.map((s, i) => (
            <View key={s.kind === "item" ? s.item._id : "see-all"} style={[styles.dot, { width: i === index ? 16 : 6, backgroundColor: i === index ? t.colors.primary : t.colors.border }]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Photo, price, title, as in For Sale. `raised`: floats over the blurred photo. */
function ItemTile({ item, width, onOpen, raised = false }: { item: PromotedListing; width: number; onOpen: (id: string) => void; raised?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.tileShadow, raised ? styles.raised : null, { backgroundColor: t.colors.card }]}>
      <Pressable
        onPress={() => onOpen(item._id)}
        accessibilityRole="link"
        accessibilityLabel={`${item.title}, ${formatNaira(item.priceNaira)}`}
        style={({ pressed }) => [styles.tile, { width, borderColor: raised ? "transparent" : t.colors.border, backgroundColor: t.colors.card, opacity: pressed ? 0.85 : 1 }]}
      >
        <View style={[styles.itemPhoto, { width, height: width, backgroundColor: t.colors.muted }]}>
          {item.photoUrl ? (
            <Image source={{ uri: sizedImage(item.photoUrl, width) }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={item._id} accessibilityIgnoresInvertColors />
          ) : (
            <Package size={28} color={t.colors.mutedForeground} />
          )}
        </View>
        <View style={styles.itemFoot}>
          <Text variant="label" numberOfLines={1} style={item.priceNaira === null ? { color: t.colors.primary } : undefined}>
            {formatNaira(item.priceNaira)}
            {item.negotiable && item.priceNaira !== null ? <Text variant="caption" tone="muted">{"  ·  Negotiable"}</Text> : null}
          </Text>
          <Text variant="caption" numberOfLines={1}>
            {item.title}
          </Text>
        </View>
      </Pressable>
    </View>
  );
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
  itemPhoto: { alignItems: "center", justifyContent: "center" },
  stage: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  scrim: { backgroundColor: "rgba(0,0,0,0.18)" },
  tileShadow: { borderRadius: 14 },
  raised: { shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  tile: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  slider: { gap: 10 },
  sliderRow: { paddingHorizontal: 16, gap: 10 },
  seeAll: { flex: 1, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center", gap: 6, padding: 16 },
  seeAllIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5 },
  dot: { height: 6, borderRadius: 3 },
  itemFoot: { paddingHorizontal: 10, paddingVertical: 8, gap: 1 },
  carouselFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, padding: 10 },
});
