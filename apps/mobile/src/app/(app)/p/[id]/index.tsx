import { useLocalSearchParams } from "expo-router";
import { PostScreen } from "@/features/feed/post-screen";

export default function Post() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PostScreen id={id} />;
}
