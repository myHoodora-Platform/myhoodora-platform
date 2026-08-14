"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
} from "framer-motion";
import { SectionHeading } from "@myhoodora/ui/section";
import {
  BellRing,
  CalendarDays,
  CheckCircle,
  ShieldAlert,
  Star,
  UserPlus,
} from "lucide-react";

type IconComponent = ComponentType<{ className?: string }>;

/* ----------------------------- push notifications ---------------------------- */

interface PushNotification {
  id: string;
  icon: IconComponent;
  iconBg: string;
  iconColor: string;
  title: string;
  message: string;
  time: string;
}

const NOTIFICATIONS: PushNotification[] = [
  {
    id: "safety",
    icon: ShieldAlert,
    iconBg: "bg-brand-coral/10",
    iconColor: "text-brand-coral",
    title: "Safety alert",
    message: "Gate near Ajah Estate is locked — use the expressway exit instead.",
    time: "now",
  },
  {
    id: "recommendation",
    icon: Star,
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    title: "New recommendation",
    message: "Tunde's Plumbing replied to your leaky-pipe request.",
    time: "2m",
  },
  {
    id: "event",
    icon: CalendarDays,
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    title: "Community event",
    message: "Street cleanup this Saturday, 9am at the community hall.",
    time: "5m",
  },
  {
    id: "neighbor",
    icon: UserPlus,
    iconBg: "bg-brand-coral/10",
    iconColor: "text-brand-coral",
    title: "New neighbor joined",
    message: "Amaka just verified her address and joined Oakwood.",
    time: "8m",
  },
];

const NOTIFICATION_DURATION = 3.2;

/* ----------------------------------- feed ----------------------------------- */

interface FeedPost {
  name: string;
  initials: string;
  time: string;
  tag: string;
  text: string;
}

const POSTS: FeedPost[] = [
  {
    name: "Jane Doe",
    initials: "JD",
    time: "2 hrs ago",
    tag: "Recommendations",
    text: "Does anyone know a good plumber in the Oakwood area? Need to fix a leaky pipe ASAP!",
  },
  {
    name: "Kwame O.",
    initials: "KO",
    time: "3 hrs ago",
    tag: "Safety",
    text: "Spotted: the streetlight on Adeola Road is out again. Careful after dark.",
  },
  {
    name: "Funmi A.",
    initials: "FA",
    time: "5 hrs ago",
    tag: "Thanks",
    text: "Thank you to everyone who helped find my cat Mocha. She's home safe!",
  },
  {
    name: "Chidi E.",
    initials: "CE",
    time: "6 hrs ago",
    tag: "Free",
    text: "Giving away a barely-used baby crib. Porch pickup in Oakwood.",
  },
  {
    name: "Tobi B.",
    initials: "TB",
    time: "1 day ago",
    tag: "Events",
    text: "Reminder: block party this Saturday at 4pm — bring a dish!",
  },
  {
    name: "Ngozi K.",
    initials: "NK",
    time: "1 day ago",
    tag: "Recommendations",
    text: "Best tailor in the area? Need school uniforms done quickly.",
  },
  {
    name: "Dele S.",
    initials: "DS",
    time: "2 days ago",
    tag: "Safety",
    text: "Security update: the new gate code starts Monday.",
  },
  {
    name: "Amina Y.",
    initials: "AY",
    time: "2 days ago",
    tag: "Welcome",
    text: "Welcome to the hood, new neighbors on 4th Street!",
  },
];

const TAG_STYLES: Record<string, string> = {
  Safety: "bg-brand-coral/10 text-brand-coral",
  Recommendations: "bg-primary/10 text-primary",
  Events: "bg-primary/10 text-primary",
  Thanks: "bg-green-500/10 text-green-600",
  Free: "bg-amber-500/10 text-amber-600",
  Welcome: "bg-brand-coral/10 text-brand-coral",
};

function FeedPost({ post }: { post: FeedPost }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
          {post.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-bold text-foreground">
              {post.name}
            </p>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {post.time}
            </span>
          </div>
        </div>
      </div>
      <p className="mt-2.5 text-sm leading-snug text-foreground">{post.text}</p>
      <span
        className={`mt-3 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${
          TAG_STYLES[post.tag] ?? "bg-primary/10 text-primary"
        }`}
      >
        {post.tag}
      </span>
    </div>
  );
}

/* ---------------------------------- section --------------------------------- */

export function CommunityFeedSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const [maxScroll, setMaxScroll] = useState(0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Measure how far the feed can scroll inside its fixed-height screen.
  useEffect(() => {
    const measure = () => {
      const feed = feedRef.current;
      const screen = screenRef.current;
      if (feed && screen) {
        setMaxScroll(Math.max(0, feed.scrollHeight - screen.clientHeight));
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const feedY = useTransform(scrollYProgress, [0, 1], [0, -maxScroll]);

  const [index, setIndex] = useState(0);
  const active = NOTIFICATIONS[index % NOTIFICATIONS.length]!;

  useEffect(() => {
    const timer = setInterval(
      () => setIndex((i) => i + 1),
      NOTIFICATION_DURATION * 1000,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <section ref={sectionRef} className="relative h-[260vh]">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-6 lg:grid-cols-2 lg:gap-16 lg:px-20">
          {/* Left — static copy */}
          <div>
            <SectionHeading
              align="left"
              kicker="Community Feed"
              title="Your neighborhood at a glance"
              description="Stay updated with your community. See where active discussions are happening, find local recommendations, and keep track of community events with our real-time feed."
            />
            <ul className="space-y-4 pt-6">
              <li className="flex items-center gap-3">
                <CheckCircle className="size-6 shrink-0 text-primary" />
                <span className="font-medium">
                  Browse topics like Local Services, Safety, and Events
                </span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="size-6 shrink-0 text-primary" />
                <span className="font-medium">
                  Connect and message verified neighbors directly
                </span>
              </li>
            </ul>
          </div>

          {/* Right — the pinned "screen" */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="overflow-hidden rounded-[2.5rem] border-[10px] border-foreground/10 bg-background shadow-2xl">
              <div
                ref={screenRef}
                className="relative h-[min(62vh,600px)] overflow-hidden bg-muted/30"
              >
                {/* Feed header */}
                <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between border-b border-border bg-card px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                      OK
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        Oakwood Neighborhood
                      </p>
                      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <span className="size-1.5 rounded-full bg-green-500" />
                        Live feed
                      </p>
                    </div>
                  </div>
                  <BellRing className="size-5 text-muted-foreground" />
                </div>

                {/* Live push notification (pinned under the header) */}
                <div className="absolute inset-x-0 top-[60px] z-20 px-3">
                  <AnimatePresence mode="popLayout">
                    <motion.div
                      key={active.id}
                      initial={{ y: -56, opacity: 0, scale: 0.96 }}
                      animate={{ y: 0, opacity: 1, scale: 1 }}
                      exit={{ y: -40, opacity: 0, scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 420, damping: 30 }}
                      className="relative overflow-hidden rounded-2xl border border-border bg-card/95 shadow-lg backdrop-blur-sm"
                    >
                      <div className="flex items-center gap-3 p-3 pr-4">
                        <div
                          className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${active.iconBg} ${active.iconColor}`}
                        >
                          <active.icon className="size-4.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-sm font-bold text-foreground">
                              {active.title}
                            </p>
                            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {active.time}
                            </span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
                            {active.message}
                          </p>
                        </div>
                      </div>
                      <motion.div
                        key={`progress-${active.id}`}
                        initial={{ width: "100%" }}
                        animate={{ width: "0%" }}
                        transition={{
                          duration: NOTIFICATION_DURATION,
                          ease: "linear",
                        }}
                        className="absolute bottom-0 left-0 h-0.5 bg-brand-coral"
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Scroll-linked feed */}
                <motion.div
                  ref={feedRef}
                  style={{ y: feedY }}
                  className="space-y-3 px-4 pb-8 pt-[120px]"
                >
                  {POSTS.map((post) => (
                    <FeedPost key={post.name} post={post} />
                  ))}
                  <p className="pt-2 text-center text-[11px] text-muted-foreground">
                    You&apos;re all caught up
                  </p>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
