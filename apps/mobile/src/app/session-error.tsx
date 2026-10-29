import { useCallback } from "react";
import { View } from "react-native";
import { useAuth } from "@/core/auth/auth-provider";
import { useOnReconnect } from "@/core/api/connection";
import { Button } from "@/shared/ui/button";
import { ErrorState } from "@/shared/ui/states";

/**
 * Signed in, but the profile couldn't be loaded (often: opened with no signal). Still signed in: retry,
 * or log out. When the connection returns it tries again by itself.
 */
export default function SessionError() {
  const { profileError, refreshProfile, logout } = useAuth();
  const retry = useCallback(() => void refreshProfile(), [refreshProfile]);
  useOnReconnect(retry);
  return (
    <View style={{ flex: 1, padding: 24 }}>
      <ErrorState error={profileError} title="We couldn't load your account" onRetry={retry} />
      <Button label="Log out" variant="ghost" onPress={() => void logout()} />
    </View>
  );
}
