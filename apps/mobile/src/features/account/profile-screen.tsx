import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@/core/navigation/use-router";
import { Calendar, Camera, Mail, MapPin, Settings, ShieldCheck } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useAuth, useSignedInUser } from "@/core/auth/auth-provider";
import { hasHood } from "@/core/auth/session-phase";
import { ListingCard } from "@/features/listings/listing-card";
import { listBySeller, listingKeys } from "@/features/listings/listings-api";
import { tint, useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Avatar } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { IconButton } from "@/shared/ui/icon-button";
import { Segmented, SettingsGroup, SettingsRow } from "@/shared/ui/settings";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { accountKeys, getPublicProfile } from "./account-api";

/** "October 2026". */
function monthYear(iso?: string): string | null {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : null;
}

type Tab = "listings" | "about";

/** Your listings, sold ones included (only you see those). */
function MyListings({ uid, hoodId }: { uid: string; hoodId: string }) {
  const user = useSignedInUser();
  const router = useRouter();
  const listings = useQuery({
    queryKey: listingKeys.seller(hoodId, uid),
    queryFn: () => listBySeller(user, hoodId, uid),
  });
  if (listings.isPending) {
    return (
      <View style={styles.grid}>
        <Skeleton width="47.5%" height={190} radius={20} />
        <Skeleton width="47.5%" height={190} radius={20} />
      </View>
    );
  }
  if (!listings.data?.length) {
    return <EmptyState title="Nothing listed yet" body="Sell or give away something you no longer need, to a neighbour nearby." action={{ label: "Sell something", onPress: () => router.push("/sell") }} />;
  }
  return (
    <View style={styles.grid}>
      {listings.data.map((l) => (
        <View key={l._id} style={styles.cell}>
          <ListingCard listing={l} />
        </View>
      ))}
    </View>
  );
}

/**
 * `/more`: you, as neighbours see you, and the way into your settings. The profile is yours to shape
 * (photo, name, a line about you); the address never shows, only the neighbourhood.
 */
export function ProfileScreen() {
  const router = useRouter();
  return (
    <AppScreen title="Profile" right={<IconButton Icon={Settings} label="Settings" onPress={() => router.push("/settings")} />}>
      <ProfileContent />
    </AppScreen>
  );
}

function ProfileContent() {
  const t = useTheme();
  const router = useRouter();
  const insets = useScreenInsets();
  const user = useSignedInUser();
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>(hasHood(profile) ? "listings" : "about");
  const pub = useQuery({ queryKey: accountKeys.publicProfile(user.uid), queryFn: () => getPublicProfile(user, user.uid), enabled: hasHood(profile) });
  const verified = profile?.verificationStatus === "verified";
  const hood = pub.data?.neighborhoodName;
  const since = monthYear(pub.data?.neighbourSince);
  const edit = () => router.push("/settings/profile");

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]} scrollIndicatorInsets={{ top: insets.top }}>
      <View style={styles.hero}>
        <Pressable onPress={edit} accessibilityRole="button" accessibilityLabel="Change your photo">
          <View style={[styles.ring, { borderColor: tint(t.colors.primary, 0.3) }]}>
            <Avatar name={profile?.displayName} photoURL={profile?.photoURL} size={104} />
          </View>
          <View style={[styles.camera, { backgroundColor: t.colors.primary, borderColor: t.colors.background }]}>
            <Camera size={16} color={t.colors.primaryForeground} />
          </View>
        </Pressable>
        <View style={styles.nameRow}>
          <Text variant="title" numberOfLines={1} accessibilityRole="header">
            {profile?.displayName ?? "Neighbour"}
          </Text>
          {verified ? <ShieldCheck size={20} color={t.colors.success} accessibilityLabel="Verified neighbour" /> : null}
        </View>
        <Text tone="muted" style={styles.centre}>
          {[hood, verified ? "Verified neighbour" : "Not verified yet"].filter(Boolean).join(" · ")}
        </Text>
        {profile?.bio ? (
          <Text style={[styles.centre, styles.bio]}>{profile.bio}</Text>
        ) : (
          <Text variant="label" tone="primary" onPress={edit} accessibilityRole="button">
            Add a line about yourself
          </Text>
        )}
        <Button label="Edit profile" variant="secondary" onPress={edit} style={styles.editButton} />
      </View>

      <Segmented
        label="Profile sections"
        value={tab}
        onChange={setTab}
        options={[
          { id: "listings", label: "Listings" },
          { id: "about", label: "About" },
        ]}
      />

      {tab === "listings" ? (
        hasHood(profile) ? (
          <MyListings uid={user.uid} hoodId={profile.neighborhoodId} />
        ) : (
          <EmptyState title="Join your neighbourhood first" body="Confirm where you live to sell and give things away." action={{ label: "Confirm my address", onPress: () => router.push("/onboarding") }} />
        )
      ) : (
        <SettingsGroup footer="Neighbours see your neighbourhood's name, never your address.">
          <SettingsRow Icon={MapPin} label="Neighbourhood" value={hood ?? (profile?.verificationStatus === "pending_review" ? "Waiting for review" : "Not joined yet")} onPress={hasHood(profile) ? undefined : () => router.push("/onboarding")} />
          {since ? <SettingsRow Icon={Calendar} label="Neighbour since" value={since} /> : null}
          <SettingsRow
            Icon={Mail}
            label="Email"
            value={profile?.email ?? user.email ?? undefined}
            description={profile?.emailVerified === false ? "Not confirmed yet: you can't post or message until it is." : "Only you and our team can see this."}
          />
        </SettingsGroup>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 20 },
  hero: { alignItems: "center", gap: 8 },
  ring: { borderRadius: 60, borderWidth: 3, padding: 3 },
  camera: { position: "absolute", right: 0, bottom: 2, width: 34, height: 34, borderRadius: 17, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, maxWidth: "90%" },
  centre: { textAlign: "center" },
  bio: { paddingHorizontal: 12 },
  editButton: { marginTop: 6, minWidth: 180, borderRadius: 999 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: { width: "47.5%", flexDirection: "row" },
});
