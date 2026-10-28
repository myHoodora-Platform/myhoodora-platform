import { errorMessage } from "@myhoodora/api-contract/errors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useEffect, useRef, useState } from "react";
import {StyleSheet, TextInput, View } from "react-native";
import { useSignedInUser } from "@/core/auth/auth-provider";
import { useRouter } from "@/core/navigation/use-router";
import { useTheme } from "@/shared/theme/theme";
import { AppScreen, useScreenInsets } from "@/shared/ui/app-screen";
import { Button } from "@/shared/ui/button";
import { InlineAlert } from "@/shared/ui/inline-alert";
import { Skeleton } from "@/shared/ui/skeleton";
import { ErrorState } from "@/shared/ui/states";
import { Text } from "@/shared/ui/text";
import { useToast } from "@/shared/ui/toast";
import { cachedPost, editPost, feedKeys, getPost } from "./feed-api";
import { PostAuthor, postText } from "./post-parts";
import { updatePostEverywhere } from "./use-reaction";
import { FormScrollView } from "@/shared/ui/form-scroll-view";
import { showDialog } from "@/shared/ui/dialog";

/** The API's limit (contract §1), and where a counter starts helping. */
const POST_MAX = 8192;
const COUNTER_FROM = 7500;

/**
 * `/p/<id>/edit`: change your post's words (its photos and details stay as posted). Saving shows the
 * new text everywhere at once; leaving with changes asks first, so nothing is lost by a stray back.
 */
export function EditPostScreen({ id }: { id: string }) {
  const user = useSignedInUser();
  const client = useQueryClient();
  const post = useQuery({ queryKey: feedKeys.post(id), queryFn: () => getPost(user, id), placeholderData: () => cachedPost(client, id) });
  if (!post.data) {
    return (
      <AppScreen title="Edit post" fallback={`/p/${id}`}>
        {post.isError ? <ErrorState error={post.error} onRetry={() => void post.refetch()} title="Couldn't load your post" /> : <Loading />}
      </AppScreen>
    );
  }
  // Keyed by the post, so the box starts from its text once (a refresh behind it never overwrites typing).
  return <Editor key={post.data._id} post={post.data} />;
}

function Loading() {
  const insets = useScreenInsets();
  return (
    <View style={[styles.body, { paddingTop: insets.top + 16 }]}>
      <Skeleton height={44} radius={22} width={180} />
      <Skeleton height={160} radius={16} />
    </View>
  );
}

function Editor({ post }: { post: NonNullable<ReturnType<typeof cachedPost>> }) {
  const user = useSignedInUser();
  const client = useQueryClient();
  const router = useRouter();
  const navigation = useNavigation();
  const toast = useToast();
  const original = postText(post);
  const [text, setText] = useState(original);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const trimmed = text.trim();
  const changed = trimmed !== original.trim();
  const canSave = changed && trimmed.length > 0 && trimmed.length <= POST_MAX && !saving;

  // Back (button, gesture or Android's) with unsaved words: ask before throwing them away.
  usePreventRemove(changed && !saving, ({ data }) =>
    showDialog("Discard your changes?", "Your post stays as it was.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]),
  );

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setProblem(null);
    try {
      const fresh = await editPost(user, post._id, trimmed);
      updatePostEverywhere(client, post._id, (p) => ({ ...p, ...fresh }));
      toast("Post updated.");
      router.back();
    } catch (err) {
      setProblem(errorMessage(err));
      setSaving(false);
    }
  };

  return (
    <AppScreen title="Edit post" fallback={`/p/${post._id}`} canvas={false} right={<Button label="Save" onPress={() => void save()} disabled={!canSave} loading={saving} style={styles.save} />}>
      <EditorBody post={post} text={text} onChange={setText} problem={problem} />
    </AppScreen>
  );
}

function EditorBody({ post, text, onChange, problem }: { post: NonNullable<ReturnType<typeof cachedPost>>; text: string; onChange: (v: string) => void; problem: string | null }) {
  const t = useTheme();
  const insets = useScreenInsets();
  const input = useRef<TextInput>(null);
  // Once the screen has slid in (Android ignores autoFocus mid-transition), with the cursor at the end.
  useEffect(() => {
    const timer = setTimeout(() => input.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, []);
  return (
    <FormScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
      <PostAuthor post={{ ...post, editedAt: null }} compact />
      {problem ? <InlineAlert>{`Your changes weren't saved: ${problem}`}</InlineAlert> : null}
      <TextInput
        ref={input}
        value={text}
        onChangeText={onChange}
        multiline
        maxLength={POST_MAX}
        placeholder="What's happening in the neighbourhood?"
        placeholderTextColor={t.colors.mutedForeground}
        accessibilityLabel="Your post"
        textAlignVertical="top"
        style={[styles.input, { color: t.colors.foreground, fontFamily: t.fonts.regular }]}
      />
      {text.length >= COUNTER_FROM ? (
        <Text variant="caption" tone={text.length >= POST_MAX ? "destructive" : "muted"} style={styles.counter}>
          {text.length} / {POST_MAX}
        </Text>
      ) : null}
      {post.mediaUrls.length ? (
        <Text variant="caption" tone="muted">
          Photos and details stay as posted. To change them, delete the post and post again.
        </Text>
      ) : null}
    </FormScrollView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, gap: 14 },
  input: { fontSize: 17, lineHeight: 25, minHeight: 160 },
  counter: { textAlign: "right" },
  save: { minHeight: 34, paddingVertical: 4, paddingHorizontal: 16, borderRadius: 999, marginRight: 4 },
});
