import { errorMessage } from "@myhoodora/api-contract/errors";
import type { Listing } from "@myhoodora/api-contract/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@/core/navigation/use-router";
import { ArrowRight, ChevronLeft, Ellipsis, Package, Share2 } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { sendMessage, startConversation } from "@/features/chat/chat-api";
import { ReportSheet } from "@/features/feed/report-sheet";
import { MIN_TOUCH, tint, useTheme } from "@/shared/theme/theme";
import { Avatar } from "@/shared/ui/avatar";
import { IconButton } from "@/shared/ui/icon-button";
import { InlineAlert } from "@/shared/ui/inline-alert";
import { PhotoPager } from "@/shared/ui/photo-pager";
import { Skeleton } from "@/shared/ui/skeleton";
import { ErrorState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { firstName, formatNaira } from "@/shared/utils/format";
import { shareLink } from "@/shared/utils/share";
import { timeAgo } from "@/shared/utils/time";
import { categoryLabel, conditionLabel, getListing, listingKeys, statusLabel } from "./listings-api";
import { SellerTools } from "./seller-tools";

/** The listing's photos edge to edge, or a placeholder when it has none. */
function Photos({ listing }: { listing: Listing }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  if (!listing.photos.length) {
    return (
      <View style={[styles.noPhoto, { height: width * 0.75, backgroundColor: t.colors.muted }]}>
        <Package size={48} color={t.colors.mutedForeground} />
      </View>
    );
  }
  return <PhotoPager photos={listing.photos} aspects={listing.photoAspects?.length ? listing.photoAspects : [1 / 0.85]} label="Photo" />;
}

/** "Hi, is this still available?": starts (or reopens) the thread and sends it in one go. */
function MessageSeller({ listing }: { listing: Listing }) {
  const t = useTheme();
  const router = useRouter();
  const user = useSignedInUser();
  const seller = listing.seller;
  const name = firstName(seller?.displayName);
  const [text, setText] = useState(name ? `Hi ${name}, is this still available?` : "Hi, is this still available?");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!seller || seller.uid === user.uid) return null;
  if (listing.status === "sold") {
    return <InlineAlert tone="info">{listing.priceNaira === null ? "This has been given away." : "This has been sold."}</InlineAlert>;
  }
  const body = text.trim();
  const send = async () => {
    if (busy || !body) return;
    setBusy(true);
    setProblem(null);
    try {
      const convo = await startConversation(user, seller.uid, listing);
      await sendMessage(user, convo._id, body);
      router.push(`/inbox/${convo._id}`);
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.group}>
      <Text variant="label">Message {firstName(seller.displayName) || "the seller"}</Text>
      <View style={[styles.messageBox, { borderColor: t.colors.border, backgroundColor: t.colors.card }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          maxLength={2000}
          accessibilityLabel={`Message to ${seller.displayName}`}
          style={[styles.messageInput, { color: t.colors.foreground, fontFamily: t.fonts.regular }]}
          returnKeyType="send"
          onSubmitEditing={() => void send()}
        />
        <Pressable
          onPress={() => void send()}
          disabled={busy || !body}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          style={[styles.sendButton, { backgroundColor: body ? t.colors.foreground : t.colors.border }]}
        >
          {busy ? <ActivityIndicator size="small" color={t.colors.background} /> : <ArrowRight size={18} color={t.colors.background} />}
        </Pressable>
      </View>
      {problem ? <InlineAlert>{problem}</InlineAlert> : null}
    </View>
  );
}

/** `/for-sale/<id>`: one listing, full width photos, the seller, and a message box. */
export function ListingScreen({ id }: { id: string }) {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useSignedInUser();
  const [reporting, setReporting] = useState(false);
  const listing = useQuery({ queryKey: listingKeys.one(id), queryFn: () => getListing(user, id) });

  const topBar = (
    <View style={[styles.topBar, { top: insets.top + 6 }]}>
      <IconButton Icon={ChevronLeft} label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/for-sale"))} filled />
      {listing.data ? (
        <View style={styles.topRight}>
          <IconButton Icon={Share2} label="Share" onPress={() => void shareLink(`/for-sale/${id}`, `${listing.data.title}, ${formatNaira(listing.data.priceNaira)} on myHoodora`)} filled />
          {listing.data.sellerUid !== user.uid ? <IconButton Icon={Ellipsis} label="More options" onPress={() => setReporting(true)} filled /> : null}
        </View>
      ) : null}
    </View>
  );

  if (listing.isPending) {
    return (
      <View style={[styles.flex, { backgroundColor: t.colors.background }]} accessible accessibilityLabel="Loading the listing">
        <Skeleton height={340} radius={0} />
        <View style={styles.content}>
          <Skeleton width="70%" height={24} />
          <Skeleton width="30%" height={20} />
          <Skeleton height={60} />
        </View>
        {topBar}
      </View>
    );
  }
  if (!listing.data) {
    return (
      <View style={[styles.flex, { backgroundColor: t.colors.background, paddingTop: insets.top + 60 }]}>
        <ErrorState error={listing.error} onRetry={() => void listing.refetch()} title="This listing isn't available" />
        {topBar}
      </View>
    );
  }

  const l = listing.data;
  const free = l.priceNaira === null;
  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: t.colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <Photos listing={l} />
        <View style={styles.content}>
          <View style={styles.group}>
            <Text style={[styles.title, { color: t.colors.foreground, fontFamily: t.fonts.bold }]} accessibilityRole="header">
              {l.title}
            </Text>
            <View style={styles.row}>
              <Text style={[styles.price, { color: free ? t.colors.primary : t.colors.foreground, fontFamily: t.fonts.bold }]}>{formatNaira(l.priceNaira)}</Text>
              {l.negotiable ? (
                <Text variant="caption" tone="muted">
                  · Negotiable
                </Text>
              ) : null}
              {l.status !== "available" ? (
                <View style={[styles.pill, { backgroundColor: l.status === "pending" ? t.colors.warningSoft : t.colors.muted }]}>
                  <Text variant="caption">{statusLabel(l.status, free)}</Text>
                </View>
              ) : null}
            </View>
          </View>
          {l.seller ? (
            <View style={styles.row}>
              <Avatar name={l.seller.displayName} photoURL={l.seller.photoURL} size={40} />
              <View>
                <Text variant="label">{l.seller.displayName}</Text>
                <Text variant="caption" tone="muted">
                  Listed {timeAgo(l.createdAt)}
                </Text>
              </View>
            </View>
          ) : null}
          {l.description ? <Text style={styles.description}>{l.description}</Text> : null}
          <View style={styles.tags}>
            <View style={[styles.tag, { backgroundColor: tint(t.colors.primary) }]}>
              <Text variant="caption" tone="primary">
                {categoryLabel(l.category)}
              </Text>
            </View>
            <View style={[styles.tag, { backgroundColor: t.colors.muted }]}>
              <Text variant="caption">{conditionLabel(l.condition)}</Text>
            </View>
          </View>
          {l.sellerUid === user.uid ? <SellerTools listing={l} /> : <MessageSeller listing={l} />}
        </View>
      </ScrollView>
      {topBar}
      <ReportSheet visible={reporting} onClose={() => setReporting(false)} targetType="listing" targetId={l._id} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  noPhoto: { alignItems: "center", justifyContent: "center" },
  topBar: { position: "absolute", left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" },
  topRight: { flexDirection: "row", gap: 8 },
  content: { padding: 20, gap: 18 },
  group: { gap: 8 },
  title: { fontSize: 24, lineHeight: 30 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  price: { fontSize: 20 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  description: { fontSize: 16, lineHeight: 23 },
  tags: { flexDirection: "row", gap: 8 },
  tag: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  messageBox: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 999, paddingLeft: 16, paddingRight: 5, minHeight: MIN_TOUCH + 2 },
  messageInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
  sendButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
});
