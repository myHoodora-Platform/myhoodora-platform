"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAdminData } from "@/context/AdminDataContext";
import { Badge } from "@myhoodora/ui/badge";
import { Button } from "@myhoodora/ui/button";
import { Input } from "@myhoodora/ui/input";
import { Textarea } from "@myhoodora/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@myhoodora/ui/select";
import { Bell, Send, Users } from "lucide-react";

const TEMPLATES = [
  {
    label: "Verification approved",
    title: "You're verified!",
    body: "Your address has been verified. Welcome to your neighbourhood feed.",
  },
  {
    label: "Maintenance notice",
    title: "Scheduled maintenance tonight",
    body: "myHoodora will be briefly unavailable for scheduled maintenance.",
  },
];

type Audience = "all" | "user" | "neighborhood";

export default function AdminNotificationsPage() {
  const { users, neighborhoods, notifications, sendNotification } =
    useAdminData();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [targetUid, setTargetUid] = useState("");
  const [targetNeighborhoodId, setTargetNeighborhoodId] = useState("");

  const reachCount = useMemo(() => {
    if (audience === "all") return users.length;
    if (audience === "user") return targetUid ? 1 : 0;
    if (audience === "neighborhood") {
      const name = neighborhoods.find((n) => n._id === targetNeighborhoodId)
        ?.name;
      if (!name) return 0;
      return users.filter((u) => u.neighborhoodName?.startsWith(name)).length;
    }
    return 0;
  }, [audience, targetUid, targetNeighborhoodId, users, neighborhoods]);

  const audienceLabel = useMemo(() => {
    if (audience === "all") return "All users";
    if (audience === "user")
      return (
        users.find((u) => u.uid === targetUid)?.displayName ??
        "Select a user"
      );
    if (audience === "neighborhood")
      return (
        neighborhoods.find((n) => n._id === targetNeighborhoodId)?.name ??
        "Select a neighbourhood"
      );
    return "";
  }, [audience, targetUid, targetNeighborhoodId, users, neighborhoods]);

  const handleSend = () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Fill in a title and message first.");
      return;
    }
    if (audience === "user" && !targetUid) {
      toast.error("Choose a user to notify.");
      return;
    }
    if (audience === "neighborhood" && !targetNeighborhoodId) {
      toast.error("Choose a neighbourhood to notify.");
      return;
    }
    sendNotification({
      title: title.trim(),
      body: body.trim(),
      audience,
      audienceLabel,
    });
    toast.success(
      `Notification sent to ${audienceLabel} (~${reachCount} users).`,
    );
    setTitle("");
    setBody("");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold tracking-tight text-slate-900">
          Compose notification
        </h2>

        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => {
                setTitle(t.title);
                setBody(t.body);
              }}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold tracking-wider text-muted-foreground uppercase">
            Title
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Scheduled maintenance tonight"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold tracking-wider text-muted-foreground uppercase">
            Message
          </label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write the notification body..."
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold tracking-wider text-muted-foreground uppercase">
            Audience
          </label>
          <Select
            value={audience}
            onValueChange={(v) => setAudience(v as Audience)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              <SelectItem value="user">Specific user</SelectItem>
              <SelectItem value="neighborhood">Neighbourhood</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {audience === "user" && (
          <Select value={targetUid} onValueChange={setTargetUid}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a user" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.uid} value={u.uid}>
                  {u.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {audience === "neighborhood" && (
          <Select
            value={targetNeighborhoodId}
            onValueChange={setTargetNeighborhoodId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose a neighbourhood" />
            </SelectTrigger>
            <SelectContent>
              {neighborhoods.map((n) => (
                <SelectItem key={n._id} value={n._id}>
                  {n.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5" />
            Estimated reach
          </span>
          <span>
            {reachCount} user{reachCount === 1 ? "" : "s"}
          </span>
        </div>

        <Button className="w-full" onClick={handleSend}>
          <Send className="size-4" />
          Send notification
        </Button>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-bold tracking-tight text-slate-900">
            Live preview
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            This is exactly how it will appear in the user&apos;s notification
            bell.
          </p>
          <div className="rounded-xl border border-slate-100 p-3">
            <div className="flex items-start gap-2.5 rounded-lg px-2.5 py-2">
              <Bell className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">
                  {title || "Notification title"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {body || "Notification message will appear here..."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-bold tracking-tight text-slate-900">
            Sent history
          </h2>
          <div className="space-y-3">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No notifications sent yet.
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className="rounded-xl border border-slate-100 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">
                      {n.title}
                    </p>
                    <Badge variant="secondary" className="shrink-0">
                      {n.audienceLabel}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {n.body}
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {new Date(n.sentAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
