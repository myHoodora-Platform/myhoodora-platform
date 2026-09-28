import type { User } from "firebase/auth";
import { apiFetch } from "./client";
import { isLive } from "./config";
import { load, save } from "./mock/store";
import { seedComments } from "./mock/seed";
import { ROUTES } from "@/lib/routes";
import type { AppNotification, Comment, Conversation, Post } from "./types";

const ALERT_LABELS: Record<string, string> = {
  security: "Security alert",
  power: "Power update",
  water: "Water update",
  flooding: "Flooding alert",
  traffic: "Traffic update",
  fire: "Fire alert",
  scam: "Scam warning",
  other: "Alert",
};

interface ReadState {
  readIds: string[];
  /** Everything created before this is read ("Mark all as read"). */
  allReadAt?: string;
}

const readKey = (uid: string) => `notif-read:${uid}`;

function readState(uid: string): ReadState {
  return load<ReadState>(readKey(uid), () => ({ readIds: [] }));
}

export interface NotificationSources {
  posts: Post[];
  conversations: Conversation[];
  verificationStatus?: string;
}

/**
 * planned: GET /notifications → AppNotification[] (newest first).
 * Preview: derived from data the app already has — neighbourhood alerts,
 * comments on your posts, unread messages and verification status.
 */
export async function listNotifications(
  user: User,
  sources: NotificationSources,
): Promise<AppNotification[]> {
  if (isLive("notifications")) return apiFetch<AppNotification[]>(user, "/notifications");

  const items: Omit<AppNotification, "read">[] = [];

  for (const post of sources.posts) {
    if (post.meta.category === "alert" && post.authorUid !== user.uid) {
      items.push({
        _id: `n_alert_${post._id}`,
        type: "alert",
        actorUid: post.authorUid,
        title: ALERT_LABELS[post.meta.alertCategory ?? "other"] ?? "Alert",
        body: post.message,
        href: ROUTES.post(post._id),
        createdAt: post.createdAt,
      });
    }
  }

  const myPostIds = new Set(sources.posts.filter((p) => p.authorUid === user.uid).map((p) => p._id));
  const comments = load<Comment[]>("comments", seedComments);
  for (const c of comments) {
    if (myPostIds.has(c.postId) && c.authorUid !== user.uid) {
      items.push({
        _id: `n_comment_${c._id}`,
        type: "comment",
        actorUid: c.authorUid,
        title: "commented on your post",
        body: c.content,
        href: `${ROUTES.post(c.postId)}#comments`,
        createdAt: c.createdAt,
      });
    }
  }

  for (const convo of sources.conversations) {
    if (convo.unreadCount > 0 && convo.lastMessage) {
      items.push({
        _id: `n_msg_${convo._id}_${convo.lastMessage.createdAt}`,
        type: "message",
        actorUid: convo.lastMessage.senderUid,
        title: "sent you a message",
        body: convo.lastMessage.body,
        href: ROUTES.conversation(convo._id),
        createdAt: convo.lastMessage.createdAt,
      });
    }
  }

  if (sources.verificationStatus && sources.verificationStatus !== "verified") {
    items.push({
      _id: "n_verification",
      type: "verification",
      title: "Verify your address",
      body: "Confirm where you live to unlock Alerts, Events, Groups and For Sale & Free.",
      href: ROUTES.settings,
      createdAt: new Date().toISOString(),
    });
  }

  const { readIds, allReadAt } = readState(user.uid);
  return items
    .map((n) => ({
      ...n,
      read:
        n.type !== "verification" &&
        (readIds.includes(n._id) || (!!allReadAt && n.createdAt <= allReadAt)),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** planned: PATCH /notifications/:id { read: true } */
export async function markNotificationRead(user: User, id: string): Promise<void> {
  if (isLive("notifications")) {
    await apiFetch<void>(user, `/notifications/${id}`, { method: "PATCH", json: { read: true } });
    return;
  }
  const s = readState(user.uid);
  if (!s.readIds.includes(id)) save(readKey(user.uid), { ...s, readIds: [...s.readIds, id] });
}

/** planned: POST /notifications/read-all */
export async function markAllNotificationsRead(user: User): Promise<void> {
  if (isLive("notifications")) {
    await apiFetch<void>(user, "/notifications/read-all", { method: "POST" });
    return;
  }
  save(readKey(user.uid), { readIds: [], allReadAt: new Date().toISOString() });
}
