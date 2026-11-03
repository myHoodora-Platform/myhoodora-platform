"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  ChevronRight,
  Home,
  ImagePlus,
  MapPin,
  Menu,
  MessageCircle,
  Plus,
  Share2,
  ShieldAlert,
  ShoppingBag,
  ThumbsUp,
  Zap,
} from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import { IOSHomeIndicator, IOSStatusBar } from "./iphone-mockup";

/**
 * The myHoodora app as it really looks on an iPhone (402 × 874 pt), with a
 * Lekki Phase 1 feed. Purely illustrative marketing content — sample
 * neighbours and posts, not real people.
 */

const NOTIFICATIONS = [
  { title: "Security alert · Lekki Phase 1", body: "Suspicious movement reported near the Admiralty Way roundabout." },
  { title: "Ngozi Fashola replied", body: "Oga Femi fixed my generator last week, I'll send you his number 👍" },
  { title: "New message about your listing", body: "Is the chest freezer still available? I can pick up after 5pm." },
];

function Avatar({ initials, tone = "bg-[#e6f1ef] text-[#147c73]" }: { initials: string; tone?: string }) {
  return (
    <span className={cn("flex size-[40px] shrink-0 items-center justify-center rounded-full text-[14px] font-bold", tone)}>
      {initials}
    </span>
  );
}

function PostHeader({ name, initials, meta, badge }: { name: string; initials: string; meta: string; badge?: string }) {
  return (
    <div className="flex items-center gap-[10px]">
      <Avatar initials={initials} />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold text-[#14201e]">{name}</p>
        <p className="text-[12.5px] text-[#5b6663]">
          {meta}
          {badge && <span className="font-semibold text-[#14201e]/70"> · {badge}</span>}
        </p>
      </div>
      <span className="text-[18px] leading-none text-[#5b6663]">···</span>
    </div>
  );
}

function Actions({ likes, comments }: { likes: number; comments?: number }) {
  return (
    <>
      <div className="flex justify-between px-[16px] pt-[8px] text-[12.5px] text-[#5b6663]">
        <span>👍 {likes}</span>
        {comments ? <span>{comments} comments</span> : null}
      </div>
      <div className="mt-[4px] flex items-center gap-[4px] border-t border-[#e5e7eb] px-[8px] py-[4px] text-[13.5px] font-semibold text-[#5b6663]">
        <span className="flex h-[36px] items-center gap-[6px] px-[8px]">
          <ThumbsUp className="size-[17px]" /> Like
        </span>
        <span className="flex h-[36px] items-center gap-[6px] px-[8px]">
          <MessageCircle className="size-[17px]" /> Comment
        </span>
        <span className="ml-auto flex h-[36px] items-center px-[8px]">
          <Share2 className="size-[17px]" />
        </span>
      </div>
    </>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <article className={cn("overflow-hidden rounded-[16px] border border-[#e5e7eb] bg-white", className)}>{children}</article>;
}

function Feed() {
  return (
    <div className="space-y-[12px] px-[12px] pt-[12px] pb-[24px]">
      {/* Active alerts: one compact card, grouped by type */}
      <section className="overflow-hidden rounded-[16px] border border-[#b45309]/30 bg-white">
        <div className="flex items-center justify-between bg-[#fef3c7]/70 px-[14px] py-[9px]">
          <p className="flex items-center gap-[8px] text-[13px] font-bold text-[#14201e]">
            <span className="size-[9px] rounded-full bg-[#b45309]" /> 2 active alerts in Lekki Phase 1
          </p>
          <span className="text-[13px] font-semibold text-[#147c73]">See all</span>
        </div>
        {[
          { icon: ShieldAlert, tone: "bg-[#fee2e2] text-[#dc2626]", label: "Security", extra: "Urgent", text: "12m ago · Suspicious movement near Admiralty Way roundabout" },
          { icon: Zap, tone: "bg-[#fef3c7] text-[#b45309]", label: "Power", extra: "· 3 reports", text: "30m ago · Light went off on Roads 5 and 7" },
        ].map((a) => (
          <div key={a.label} className="flex items-center gap-[10px] border-t border-[#e5e7eb] px-[14px] py-[9px]">
            <span className={cn("flex size-[34px] items-center justify-center rounded-full", a.tone)}>
              <a.icon className="size-[16px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-[6px] text-[13.5px] font-bold text-[#14201e]">
                {a.label}
                {a.extra === "Urgent" ? (
                  <span className="rounded-full bg-[#dc2626] px-[7px] py-[1px] text-[10.5px] text-white">Urgent</span>
                ) : (
                  <span className="font-semibold text-[#5b6663]">{a.extra}</span>
                )}
              </span>
              <span className="block truncate text-[12.5px] text-[#5b6663]">{a.text}</span>
            </span>
            <ChevronRight className="size-[16px] text-[#5b6663]" />
          </div>
        ))}
      </section>

      {/* Composer prompt */}
      <div className="flex items-center gap-[10px] rounded-[16px] border border-[#e5e7eb] bg-white p-[10px]">
        <Avatar initials="AO" />
        <span className="flex h-[40px] flex-1 items-center rounded-full bg-[#f2f2f2] px-[14px] text-[14.5px] text-[#737373]">
          What&apos;s happening, neighbour?
        </span>
        <ImagePlus className="size-[20px] text-[#147c73]" />
      </div>

      <Card>
        <div className="space-y-[10px] p-[16px] pb-[8px]">
          <PostHeader name="Chidinma Eze" initials="CE" meta="Lekki Phase 1 · 25m" badge="Recommendation" />
          <p className="text-[15px] leading-[1.45] text-[#14201e]/90">
            Please, who knows a reliable generator repairer around Admiralty Way? Mine just packed up 😩
          </p>
        </div>
        <Actions likes={8} comments={12} />
      </Card>

      <Card>
        <div className="space-y-[10px] p-[16px] pb-[8px]">
          <PostHeader name="Tunde Bakare" initials="TB" meta="Lekki Phase 1 · 2h" badge="Poll" />
          <p className="text-[15px] leading-[1.45] font-semibold text-[#14201e]">
            Road 12: should we contribute for a bigger transformer?
          </p>
          {[
            ["Yes, let's contribute", 57, true],
            ["No, push DisCo to pay", 14, false],
            ["I need more information", 29, false],
          ].map(([label, pct, mine]) => (
            <div key={label as string} className="relative flex h-[40px] items-center justify-between overflow-hidden rounded-[12px] border border-[#e5e7eb] px-[14px] text-[14px]">
              <span className={cn("absolute inset-y-0 left-0", mine ? "bg-[#147c73]/20" : "bg-[#f2f2f2]")} style={{ width: `${pct}%` }} />
              <span className={cn("relative", mine && "font-bold")}>{label as string}</span>
              <span className="relative font-semibold">{pct as number}%</span>
            </div>
          ))}
          <p className="text-[12.5px] text-[#5b6663]">14 votes · 3 days left · Votes are anonymous</p>
        </div>
        <Actions likes={21} comments={9} />
      </Card>

      <Card>
        <div className="space-y-[10px] p-[16px] pb-[8px]">
          <PostHeader name="Ibrahim Musa" initials="IM" meta="Lekki Phase 1 · 5h" badge="For sale" />
          <div className="flex gap-[12px] rounded-[12px] bg-[#f4f5f4] p-[10px]">
            <span className="flex size-[64px] items-center justify-center rounded-[10px] bg-[#e6f1ef]">
              <Zap className="size-[26px] text-[#147c73]" />
            </span>
            <span>
              <span className="block text-[17px] font-bold text-[#14201e]">₦380,000</span>
              <span className="block text-[14px] text-[#14201e]/90">2.5KVA inverter + 2 batteries</span>
              <span className="block text-[12.5px] text-[#5b6663]">Good condition · Negotiable</span>
            </span>
          </div>
        </div>
        <Actions likes={5} comments={4} />
      </Card>

      <Card>
        <div className="space-y-[10px] p-[16px] pb-[8px]">
          <PostHeader name="Adaeze Okafor" initials="AO" meta="Lekki Phase 1 · 1d" badge="Event" />
          <div className="space-y-[4px] rounded-[12px] bg-[#147c73]/5 px-[12px] py-[10px] text-[14px] font-semibold text-[#147c73]">
            <p className="flex items-center gap-[8px]">
              <CalendarDays className="size-[16px]" /> Sat, 4 Oct · 8:00 AM
            </p>
            <p className="flex items-center gap-[8px]">
              <MapPin className="size-[16px]" /> Road 12 park, by the water tank
            </p>
          </div>
          <p className="text-[15px] leading-[1.45] text-[#14201e]/90">
            Monthly estate sanitation 🧹 Gloves and bags provided. Zobo and puff-puff after!
          </p>
        </div>
        <Actions likes={34} comments={15} />
      </Card>
    </div>
  );
}

export function PhoneAppScreen() {
  const [index, setIndex] = useState(0);
  const [showing, setShowing] = useState(false);

  // An iOS notification drops from the Dynamic Island every few seconds.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let hide: ReturnType<typeof setTimeout>;
    const cycle = () => {
      setShowing(true);
      hide = setTimeout(() => setShowing(false), 3600);
    };
    const first = setTimeout(cycle, 1400);
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % NOTIFICATIONS.length);
      cycle();
    }, 6500);
    return () => {
      clearTimeout(first);
      clearTimeout(hide);
      clearInterval(timer);
    };
  }, []);

  const n = NOTIFICATIONS[index]!;

  return (
    <div className="relative flex size-full flex-col bg-[#f4f5f4] font-sans text-[#14201e]">
      <div className="bg-white">
        <IOSStatusBar />
        {/* App header */}
        <div className="flex h-[56px] items-center gap-[10px] border-b border-[#e5e7eb] px-[16px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- brand wordmark SVG from /public */}
          <img src="/logo/mascot-wordmark.svg" alt="" className="h-[30px] w-auto" />
          <span className="ml-auto flex size-[40px] items-center justify-center rounded-full bg-[#f2f2f2]">
            <MessageCircle className="size-[19px]" />
          </span>
          <span className="relative flex size-[40px] items-center justify-center rounded-full bg-[#f2f2f2]">
            <Bell className="size-[19px]" />
            <span className="absolute -top-[1px] -right-[1px] flex size-[18px] items-center justify-center rounded-full bg-[#ff6b5b] text-[10px] font-bold text-white ring-2 ring-white">
              3
            </span>
          </span>
          <Avatar initials="AO" tone="bg-[#147c73] text-white" />
        </div>
      </div>

      {/* Feed, gently scrolling like a neighbour browsing */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="animate-[phone-feed-scroll_26s_ease-in-out_infinite_alternate] motion-reduce:animate-none">
          <Feed />
        </div>
      </div>

      {/* Tab bar */}
      <nav className="relative h-[83px] border-t border-[#e5e7eb] bg-white">
        <div className="flex h-[52px] items-stretch text-[10.5px] font-semibold text-[#14201e]/70">
          {[
            { icon: Home, label: "Home", active: true },
            { icon: ShoppingBag, label: "For Sale" },
          ].map((t) => (
            <span key={t.label} className={cn("flex flex-1 flex-col items-center justify-center gap-[2px]", t.active && "text-[#147c73]")}>
              <t.icon className="size-[24px]" strokeWidth={t.active ? 2.4 : 1.8} />
              {t.label}
            </span>
          ))}
          <span className="flex flex-1 items-center justify-center">
            <span className="flex size-[48px] items-center justify-center rounded-full bg-[#147c73] text-white shadow-lg shadow-[#147c73]/30">
              <Plus className="size-[24px]" />
            </span>
          </span>
          {[
            { icon: AlertTriangle, label: "Alerts" },
            { icon: Menu, label: "More" },
          ].map((t) => (
            <span key={t.label} className="flex flex-1 flex-col items-center justify-center gap-[2px]">
              <t.icon className="size-[24px]" strokeWidth={1.8} />
              {t.label}
            </span>
          ))}
        </div>
        <IOSHomeIndicator />
      </nav>

      {/* iOS notification banner */}
      <div
        aria-hidden
        className={cn(
          "absolute top-[54px] left-[10px] right-[10px] z-40 rounded-[22px] bg-white/80 p-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all duration-500 ease-out",
          showing ? "translate-y-0 opacity-100" : "-translate-y-[120%] opacity-0",
        )}
      >
        <div className="flex gap-[10px]">
          <span className="flex size-[38px] shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-[#147c73]">
            {/* eslint-disable-next-line @next/next/no-img-element -- app icon from /public */}
            <img src="/favicon/icon-192.png" alt="" className="size-full object-cover" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between">
              <p className="truncate text-[14px] font-semibold">{n.title}</p>
              <span className="text-[12px] text-[#5b6663]">now</span>
            </div>
            <p className="text-[13.5px] leading-snug text-[#14201e]/85">{n.body}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
