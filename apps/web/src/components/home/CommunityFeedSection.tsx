"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { motion, AnimatePresence, useScroll } from "framer-motion";
import {
  BatteryFull,
  BellRing,
  CalendarDays,
  CheckCircle,
  Heart,
  MessageCircle,
  ShieldAlert,
  Signal,
  Star,
  UserPlus,
  Wifi,
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
    message:
      "Gate near Ajah Estate is locked — use the expressway exit instead.",
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

/* ----------------------------------- feed ----------------------------------- */

interface FeedPost {
  name: string;
  initials: string;
  time: string;
  tag: string;
  text: string;
  likes: number;
  comments: number;
}

const STORIES = [
  { initials: "OK", name: "Oakwood" },
  { initials: "JD", name: "Jane" },
  { initials: "KO", name: "Kwame" },
  { initials: "FA", name: "Funmi" },
  { initials: "TB", name: "Tobi" },
];

const POSTS: FeedPost[] = [
  {
    name: "Jane Doe",
    initials: "JD",
    time: "2 hrs ago",
    tag: "Recommendations",
    text: "Does anyone know a good plumber in the Oakwood area? Need to fix a leaky pipe ASAP!",
    likes: 12,
    comments: 7,
  },
  {
    name: "Kwame O.",
    initials: "KO",
    time: "3 hrs ago",
    tag: "Safety",
    text: "Spotted: the streetlight on Adeola Road is out again. Careful after dark.",
    likes: 31,
    comments: 5,
  },
  {
    name: "Funmi A.",
    initials: "FA",
    time: "5 hrs ago",
    tag: "Thanks",
    text: "Thank you to everyone who helped find my cat Mocha. She's home safe!",
    likes: 58,
    comments: 14,
  },
  {
    name: "Chidi E.",
    initials: "CE",
    time: "6 hrs ago",
    tag: "Free",
    text: "Giving away a barely-used baby crib. Porch pickup in Oakwood.",
    likes: 9,
    comments: 3,
  },
  {
    name: "Tobi B.",
    initials: "TB",
    time: "1 day ago",
    tag: "Events",
    text: "Reminder: block party this Saturday at 4pm — bring a dish!",
    likes: 44,
    comments: 11,
  },
  {
    name: "Ngozi K.",
    initials: "NK",
    time: "1 day ago",
    tag: "Recommendations",
    text: "Best tailor in the area? Need school uniforms done quickly.",
    likes: 6,
    comments: 9,
  },
  {
    name: "Dele S.",
    initials: "DS",
    time: "2 days ago",
    tag: "Safety",
    text: "Security update: the new gate code starts Monday.",
    likes: 27,
    comments: 2,
  },
  {
    name: "Amina Y.",
    initials: "AY",
    time: "2 days ago",
    tag: "Welcome",
    text: "Welcome to the hood, new neighbors on 4th Street!",
    likes: 19,
    comments: 4,
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
  const [liked, setLiked] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
          {post.initials}
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <p className="truncate text-[13px] font-bold text-foreground">
            {post.name}
          </p>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {post.time}
          </span>
        </div>
      </div>

      <p className="mt-2 text-[13px] leading-snug text-foreground">
        {post.text}
      </p>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            TAG_STYLES[post.tag] ?? "bg-primary/10 text-primary"
          }`}
        >
          {post.tag}
        </span>

        <div className="flex items-center gap-1 text-muted-foreground">
          <button
            type="button"
            onClick={() => setLiked((v) => !v)}
            aria-pressed={liked}
            aria-label={liked ? "Unlike" : "Like"}
            className="flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors hover:bg-muted"
          >
            <Heart
              className={`size-4 transition-colors ${
                liked ? "fill-brand-coral text-brand-coral" : ""
              }`}
            />
            <span className="text-xs tabular-nums">
              {post.likes + (liked ? 1 : 0)}
            </span>
          </button>
          <span className="flex items-center gap-1 px-1.5">
            <MessageCircle className="size-4" />
            <span className="text-xs tabular-nums">{post.comments}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- section --------------------------------- */

export function CommunityFeedSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [maxScroll, setMaxScroll] = useState(0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Measure how far the phone's feed can scroll inside its screen.
  useEffect(() => {
    const measure = () => {
      const el = scrollRef.current;
      if (el) setMaxScroll(Math.max(0, el.scrollHeight - el.clientHeight));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Drive the phone's internal scroll from the page scroll while the section is pinned.
  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (v: number) => {
      const el = scrollRef.current;
      if (el) el.scrollTop = v * maxScroll;
    });
    return unsubscribe;
  }, [scrollYProgress, maxScroll]);

  // Transient push notification: in for ~2.8s, out for ~1.8s, then the next.
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const active = NOTIFICATIONS[index % NOTIFICATIONS.length]!;

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout>;
    let nextTimer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      setVisible(true);
      hideTimer = setTimeout(() => setVisible(false), 2800);
      nextTimer = setTimeout(() => {
        setIndex((i) => i + 1);
        schedule();
      }, 4600);
    };
    schedule();

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(nextTimer);
    };
  }, []);

  return (
    <section ref={sectionRef} className="relative h-[220vh] lg:h-[260vh]">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-6 px-4 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-12">
          {/* Copy — above the phone on mobile, left column on desktop */}
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              Community Feed
            </span>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
              Your neighborhood at a glance
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base lg:mx-0">
              Real-time updates from the people on your street —
              recommendations, safety alerts, and local events.
            </p>
            <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground sm:text-sm lg:justify-start">
              <li className="flex items-center gap-2">
                <CheckCircle className="size-4 shrink-0 text-primary" />
                Verified neighbors
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="size-4 shrink-0 text-primary" />
                Real-time alerts
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="size-4 shrink-0 text-primary" />
                Local recommendations
              </li>
            </ul>
          </div>

          {/* The device — right column on desktop, centered on mobile */}
          <div className="flex justify-center">
            <div className="relative w-[270px] sm:w-[330px] lg:w-[360px]">
              {/* Side buttons */}
              <div className="absolute -left-[3px] top-[26%] h-7 w-[3px] rounded-l-md bg-zinc-600" />
              <div className="absolute -left-[3px] top-[38%] h-11 w-[3px] rounded-l-md bg-zinc-600" />
              <div className="absolute -left-[3px] top-[50%] h-11 w-[3px] rounded-l-md bg-zinc-600" />
              <div className="absolute -right-[3px] top-[30%] h-16 w-[3px] rounded-r-md bg-zinc-600" />

              {/* Titanium frame */}
              <div className="rounded-[2.9rem] bg-gradient-to-b from-zinc-500 via-zinc-700 to-zinc-500 p-[2px] shadow-[0_40px_90px_-25px_rgba(0,0,0,0.55)]">
                {/* Black bezel */}
                <div className="rounded-[2.85rem] bg-black p-[3px]">
                  {/* Screen */}
                  <div className="relative h-[min(52vh,440px)] cursor-ns-resize overflow-hidden rounded-[2.6rem] bg-muted/30 sm:h-[min(58vh,560px)] lg:h-[min(62vh,600px)]">
                    {/* Status bar */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 pt-3.5 text-foreground">
                      <span className="text-[13px] font-semibold tabular-nums">
                        9:41
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Signal className="size-3.5" />
                        <Wifi className="size-3.5" />
                        <BatteryFull className="size-4" />
                      </div>
                    </div>

                    {/* Dynamic island */}
                    <div className="absolute left-1/2 top-2.5 z-40 h-[26px] w-[90px] -translate-x-1/2 rounded-full bg-black" />

                    {/* App header (fixed) */}
                    <div className="absolute inset-x-0 top-11 z-20 flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
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

                    {/* Transient push notification (floats over the feed) */}
                    <div className="pointer-events-none absolute inset-x-0 top-[92px] z-20 px-3">
                      <AnimatePresence mode="popLayout">
                        {visible && (
                          <motion.button
                            type="button"
                            key={active.id}
                            onClick={() => setIndex((i) => i + 1)}
                            aria-label="Dismiss notification"
                            initial={{ y: -56, opacity: 0, scale: 0.96 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: -40, opacity: 0, scale: 0.98 }}
                            transition={{
                              type: "spring",
                              stiffness: 420,
                              damping: 30,
                            }}
                            className="pointer-events-auto relative w-full overflow-hidden rounded-2xl border border-border bg-card/95 text-left shadow-lg backdrop-blur-sm"
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
                              transition={{ duration: 2.8, ease: "linear" }}
                              className="absolute bottom-0 left-0 h-0.5 bg-brand-coral"
                            />
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Scrollable feed (driven by page scroll while pinned) */}
                    <div
                      ref={scrollRef}
                      className="absolute inset-x-0 bottom-0 top-[92px] z-10 overflow-hidden"
                    >
                      <div className="space-y-2.5 px-3.5 pb-12 pt-3">
                        {/* Stories row */}
                        <div className="flex items-center gap-3 px-1 pb-1">
                          {STORIES.map((s) => (
                            <div
                              key={s.initials}
                              className="flex flex-col items-center gap-1"
                            >
                              <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-tr from-primary/40 to-brand-coral/40 p-[2px]">
                                <div className="flex size-full items-center justify-center rounded-full bg-card text-[11px] font-bold text-foreground">
                                  {s.initials}
                                </div>
                              </div>
                              <span className="text-[9px] text-muted-foreground">
                                {s.name}
                              </span>
                            </div>
                          ))}
                        </div>

                        {POSTS.map((post) => (
                          <FeedPost key={post.name} post={post} />
                        ))}

                        <p className="pt-2 text-center text-[11px] text-muted-foreground">
                          You&apos;re all caught up
                        </p>
                      </div>
                    </div>

                    {/* Home indicator */}
                    <div className="absolute bottom-1.5 left-1/2 z-30 h-1 w-24 -translate-x-1/2 rounded-full bg-black/80" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
