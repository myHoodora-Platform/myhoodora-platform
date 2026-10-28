import { Bomb, Bug, Skull, Unplug } from "lucide-react-native";
import { useState } from "react";

import { config } from "@/core/config/env";
import { crashNatively, monitoringActive, sendTestError, sendTestRejection } from "@/core/monitoring/monitoring";
import { SettingsGroup, SettingsRow } from "@/shared/ui/settings";
import { useToast } from "@/shared/ui/toast";
import { showDialog } from "@/shared/ui/dialog";

/** Throws while rendering, so the app's error boundary shows the crash screen. */
function RenderCrash(): never {
  throw new Error("WP-1 test render crash");
}

/**
 * Settings → Diagnostics: ways to make the app fail on purpose, to check crash reporting end to end in
 * a preview build. Only shown when EXPO_PUBLIC_QA_TOOLS=true, which production builds ignore.
 */
export function DiagnosticsGroup() {
  const toast = useToast();
  const [crashRender, setCrashRender] = useState(false);
  if (!config().qaTools) return null;

  const reporting = monitoringActive();
  const confirmNativeCrash = () =>
    showDialog("Crash the app?", "The app closes at once. Open it again so the report is sent.", [
      { text: "Cancel", style: "cancel" },
      { text: "Crash", style: "destructive", onPress: crashNatively },
    ]);

  return (
    <SettingsGroup
      title="Diagnostics"
      footer={reporting ? "Test builds only. Each report should reach Sentry with the made-up email, phone and token shown as [Filtered]." : "Crash reporting is off in this build (no Sentry DSN, or a development build)."}
    >
      <SettingsRow
        Icon={Bug}
        label="Send a test error"
        description="Handled; the app carries on"
        onPress={() => {
          sendTestError();
          toast("Test error sent");
        }}
      />
      <SettingsRow
        Icon={Unplug}
        label="Send an unhandled rejection"
        description="A failed promise nothing catches"
        onPress={() => {
          sendTestRejection();
          toast("Test rejection raised");
        }}
      />
      <SettingsRow Icon={Bomb} label="Crash this screen" description="Shows the crash screen" onPress={() => setCrashRender(true)} />
      <SettingsRow Icon={Skull} label="Crash the app (native)" description="Closes the app; reported on next start" destructive onPress={confirmNativeCrash} />
      {crashRender ? <RenderCrash /> : null}
    </SettingsGroup>
  );
}
