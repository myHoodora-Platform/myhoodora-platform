import { useLocalSearchParams } from "expo-router";
import { WebScreen } from "@/features/web/web-screen";

/** `/web?path=/guidelines`: a page of the website inside the app (signed in or not). */
export default function Web() {
  const { path, title } = useLocalSearchParams<{ path?: string; title?: string }>();
  return <WebScreen path={path} title={title} />;
}
