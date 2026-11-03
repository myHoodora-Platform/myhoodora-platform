import { useLocalSearchParams } from "expo-router";
import { AppealScreen } from "@/features/moderation/decisions-screen";

/** `/settings/moderation/<caseId>`: appeal one decision. */
export default function Appeal() {
  const { caseId } = useLocalSearchParams<{ caseId: string }>();
  return <AppealScreen caseId={caseId} />;
}
