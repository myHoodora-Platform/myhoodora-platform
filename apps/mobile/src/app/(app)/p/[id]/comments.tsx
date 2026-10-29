import { useLocalSearchParams } from "expo-router";
import { CommentsSheet } from "@/features/comments/comments-sheet";

/** A post's comments in a sheet over whatever opened it (see the (app) layout for its sizes). */
export default function PostComments() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CommentsSheet id={id} />;
}
