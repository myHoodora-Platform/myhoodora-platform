import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { reportError } from "@/core/monitoring/monitoring";
import { pushPermission, registerPush, requestPushPermission, type PushPermission } from "@/core/push/push";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/layout";
import { Text } from "@/shared/ui/text";

const DISMISSED_KEY = "push.prompt.dismissed";

/**
 * Asks for notifications in context, once, before the system prompt (which iOS only ever shows once).
 * "Not now" is remembered on this phone; the More screen always offers it again.
 */
export function PushPrompt() {
  const user = useSignedInUser();
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void pushPermission().then(setPermission);
    void AsyncStorage.getItem(DISMISSED_KEY).then((v) => setDismissed(v === "1"));
  }, []);

  if (dismissed || permission !== "undetermined") return null;

  const enable = async () => {
    setBusy(true);
    try {
      const result = await requestPushPermission();
      setPermission(result);
      if (result === "granted") await registerPush(user);
    } catch (err) {
      reportError(err, "push-enable");
    } finally {
      setBusy(false);
    }
  };

  const notNow = () => {
    setDismissed(true);
    void AsyncStorage.setItem(DISMISSED_KEY, "1");
  };

  return (
    <Card>
      <Text variant="heading">Hear about urgent alerts</Text>
      <Text tone="muted">Get a notification when neighbours post a safety alert, reply to you or message you. You can change this any time in Settings.</Text>
      <View style={styles.row}>
        <Button label="Turn on" onPress={enable} loading={busy} style={styles.flex} />
        <Button label="Not now" variant="ghost" onPress={notNow} style={styles.flex} />
      </View>
    </Card>
  );
}

/** For the More screen: the current state, and the way to change it. */
export function usePushSetting() {
  const user = useSignedInUser();
  const [permission, setPermission] = useState<PushPermission | null>(null);
  useEffect(() => {
    void pushPermission().then(setPermission);
  }, []);
  const change = async () => {
    // Once denied, only the system Settings app can turn it back on.
    if (permission === "denied") return Linking.openSettings();
    const result = await requestPushPermission();
    setPermission(result);
    if (result === "granted") await registerPush(user);
  };
  return { permission, change };
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
});
