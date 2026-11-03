import { useLocalSearchParams } from "expo-router";
import { ForwardScreen } from "@/features/chat/forward-screen";

export default function Forward() {
  const { from, message } = useLocalSearchParams<{ from: string; message: string }>();
  return <ForwardScreen from={from} messageId={message} />;
}
