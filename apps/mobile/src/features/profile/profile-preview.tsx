import { errorMessage } from "@myhoodora/api-contract/errors";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { accountKeys, getPublicProfile } from "@/features/account/account-api";
import { useTheme } from "@/shared/theme/theme";
import { BottomSheet } from "@/shared/ui/bottom-sheet";
import { Button } from "@/shared/ui/button";
import { Text } from "@/shared/ui/text";
import { NeighbourCard } from "./neighbour-card";
import { useMessageNeighbour } from "./use-message-neighbour";
import { useOpenProfile } from "./use-open-profile";

/**
 * Long-press someone's face or name: who they are in a small sheet, without leaving the feed, with
 * "View profile" and "Message". Public profile fields only; if it isn't available to you, says why.
 */
export function ProfilePreview({ uid, onClose }: { uid: string | null; onClose: () => void }) {
  const t = useTheme();
  const user = useSignedInUser();
  const openProfile = useOpenProfile();
  const message = useMessageNeighbour();
  const [height, setHeight] = useState<number | undefined>(undefined);
  const profile = useQuery({ queryKey: accountKeys.publicProfile(uid ?? ""), queryFn: () => getPublicProfile(user, uid!), enabled: !!uid, staleTime: 60_000 });
  if (!uid) return null;
  const mine = uid === user.uid;
  const leave = (then: () => void) => {
    onClose();
    then();
  };
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={styles.flex}>
        <BottomSheet label="Profile preview" onClose={onClose} header={() => null} minOpen={0} contentHeight={profile.isPending ? undefined : height}>
          <View style={styles.body} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
            {profile.data ? (
              <>
                <NeighbourCard profile={profile.data} size={72} />
                <View style={styles.actions}>
                  <Button label={mine ? "Your profile" : "View profile"} variant="secondary" style={styles.flex} onPress={() => leave(() => openProfile(uid))} />
                  {!mine ? <Button label="Message" style={styles.flex} loading={message.busy} onPress={() => leave(() => void message.open(uid))} /> : null}
                </View>
              </>
            ) : profile.isError ? (
              <Text tone="muted" style={styles.centred}>
                {errorMessage(profile.error)}
              </Text>
            ) : (
              <ActivityIndicator color={t.colors.primary} style={styles.loading} accessibilityLabel="Loading profile" />
            )}
          </View>
        </BottomSheet>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 20 },
  actions: { flexDirection: "row", gap: 12 },
  centred: { textAlign: "center", paddingVertical: 24 },
  loading: { paddingVertical: 48 },
});
