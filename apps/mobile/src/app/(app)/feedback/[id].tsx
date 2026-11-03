import { useLocalSearchParams } from "expo-router";
import { FeedbackScreen } from "@/features/feedback/feedback-screen";

export default function Feedback() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FeedbackScreen id={id} />;
}
