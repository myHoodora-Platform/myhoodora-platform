import { useLocalSearchParams } from "expo-router";
import { ConversationScreen } from "@/features/chat/conversation-screen";

export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ConversationScreen id={id} />;
}
