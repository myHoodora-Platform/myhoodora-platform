"use client";

import { useAuth } from "@/context/AuthContext";
import { VerifiedGate } from "@/components/shared/VerifiedGate";
import { FeaturePreviewHeader } from "@/components/dashboard/feature-preview-header";
import { Button } from "@myhoodora/ui/button";
import { Badge } from "@myhoodora/ui/badge";
import { Shield, ShieldAlert, Cat, MessageCircle, Users } from "lucide-react";

type AlertCategory =
  | "Crime"
  | "Suspicious Activity"
  | "Lost Pet"
  | "Community Notice";

const CATEGORY_STYLES: Record<AlertCategory, string> = {
  Crime: "bg-rose-100 text-rose-700",
  "Suspicious Activity": "bg-amber-100 text-amber-700",
  "Lost Pet": "bg-sky-100 text-sky-700",
  "Community Notice": "bg-slate-100 text-slate-700",
};

interface WatchAlert {
  category: AlertCategory;
  title: string;
  description: string;
  author: string;
  verified: boolean;
  time: string;
}

const mockAlerts: WatchAlert[] = [
  {
    category: "Suspicious Activity",
    title: "Unfamiliar van circling Bourdillon Road",
    description:
      "A white delivery van has passed by three times in the last hour without stopping anywhere. Keeping an eye out — let's watch out for each other.",
    author: "Adaeze O.",
    verified: true,
    time: "18m ago",
  },
  {
    category: "Lost Pet",
    title: "Missing: grey tabby cat, green collar",
    description:
      "Answers to 'Milo'. Last seen near the estate gate this morning. Please reach out if spotted — reward offered.",
    author: "Tunde A.",
    verified: true,
    time: "1h ago",
  },
  {
    category: "Community Notice",
    title: "Estate gate repairs this weekend",
    description:
      "The security team will be servicing the main gate barrier Saturday 9am–1pm. Expect brief delays on entry/exit.",
    author: "Estate Management",
    verified: true,
    time: "3h ago",
  },
  {
    category: "Crime",
    title: "Attempted break-in reported nearby",
    description:
      "A neighbor two streets over reported an attempted break-in overnight. No one was hurt. Please ensure gates and doors are locked.",
    author: "Ngozi F.",
    verified: true,
    time: "Yesterday",
  },
];

export default function SafetyWatchPage() {
  const { runGatedAction } = useAuth();

  const handleJoin = () => {
    runGatedAction(() => {
      // No backend for this feature yet — demo action only.
    });
  };

  return (
    <VerifiedGate>
      <div className="space-y-6">
        <FeaturePreviewHeader
          icon={Shield}
          title="Safety Watch Group"
          description="Real-time safety alerts and neighborhood watch updates, shared by verified neighbors near you."
        />

        <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {[
                "bg-primary/20",
                "bg-amber-200",
                "bg-rose-200",
                "bg-sky-200",
              ].map((color, i) => (
                <div
                  key={i}
                  className={`flex size-8 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-slate-700 ${color}`}
                >
                  <Users className="size-3.5" />
                </div>
              ))}
            </div>
            <p className="text-sm font-semibold text-slate-700">
              128 verified neighbors in this group
            </p>
          </div>
          <Button size="sm" onClick={handleJoin}>
            Join Group
          </Button>
        </div>

        <div className="space-y-4">
          {mockAlerts.map((alert, idx) => (
            <article
              key={idx}
              className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <Badge className={CATEGORY_STYLES[alert.category]}>
                  {alert.category === "Crime" ||
                  alert.category === "Suspicious Activity" ? (
                    <ShieldAlert className="size-3" />
                  ) : alert.category === "Lost Pet" ? (
                    <Cat className="size-3" />
                  ) : (
                    <MessageCircle className="size-3" />
                  )}
                  {alert.category}
                </Badge>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {alert.time}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  {alert.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {alert.description}
                </p>
              </div>
              <p className="text-xs font-semibold text-slate-500">
                Posted by {alert.author}
                {alert.verified && (
                  <span className="ml-1 text-primary">· verified neighbor</span>
                )}
              </p>
            </article>
          ))}
        </div>
      </div>
    </VerifiedGate>
  );
}
