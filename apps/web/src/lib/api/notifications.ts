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

const ALERT_PLURALS: Record<string, string> = {
  security: "security alerts",
  power: "power updates",
  water: "water updates",
  flooding: "flooding alerts",
  traffic: "traffic updates",
  fire: "fire alerts",
  scam: "scam warnings",
  other: "alerts",
};

/** Alerts of the same type this close together are one notification. */
const BUNDLE_WINDOW_MS = 30 * 60 * 1000;

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

  // Bundle alert storms: same type within 30 minutes → one notification
  // ("3 power alerts") instead of one per post.
  const alerts = sources.posts
    .filter((p) => p.meta.category === "alert" && p.authorUid !== user.uid)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const bundles: Post[][] = [];
  for (const post of alerts) {
    const category = post.meta.alertCategory ?? "other";
    const bundle = bundles.find(
      (b) =>
        (b[0]!.meta.alertCategory ?? "other") === category &&
        new Date(b[b.length - 1]!.createdAt).getTime() - new Date(post.createdAt).getTime() <= BUNDLE_WINDOW_MS,
    );
    if (bundle) bundle.push(post);
    else bundles.push([post]);
  }
  for (const bundle of bundles) {
    const latest = bundle[0]!;
    const category = latest.meta.alertCategory ?? "other";
    items.push(
      bundle.length === 1
        ? {
            _id: `n_alert_${latest._id}`,
            type: "alert",
            actorUid: latest.authorUid,
            title: ALERT_LABELS[category] ?? "Alert",
            body: latest.message,
            href: ROUTES.post(latest._id),
            createdAt: latest.createdAt,
          }
        : {
            _id: `n_alerts_${category}_${latest._id}`,
            type: "alert",
            title: `${bundle.length} ${ALERT_PLURALS[category] ?? "alerts"}`,
            body: latest.message,
            href: `${ROUTES.alerts}?type=${category}`,
            createdAt: latest.createdAt,
          },
    );
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
