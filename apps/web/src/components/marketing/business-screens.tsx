import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  Clock,
  Home,
  Menu,
  MessageCircle,
  Phone,
  Plus,
  Share2,
  ShoppingBag,
  AlertTriangle,
  ThumbsUp,
  Utensils,
  Wrench,
  Zap,
} from "lucide-react";
import { cn } from "@myhoodora/ui/utils";
import { IOSHomeIndicator, IOSStatusBar } from "./iphone-mockup";

/**
 * Illustrative screens for the For Business page, drawn at real iPhone
 * point size (402 × 874). Sample businesses and neighbours, not real people.
 */


export function AppChrome({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="flex size-full flex-col bg-[#f4f5f4] font-sans text-[#14201e]">
      <div className="bg-white">
        <IOSStatusBar />
        <div className="flex h-[56px] items-center gap-[10px] border-b border-[#e5e7eb] px-[16px]">
          {title ? (
            <>
              <ArrowLeft className="size-[22px]" />
              <p className="text-[17px] font-bold">{title}</p>
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- brand wordmark SVG from /public
            <img src="/logo/mascot-wordmark.svg" alt="" className="h-[30px] w-auto" />
          )}
          <span className="ml-auto flex size-[40px] items-center justify-center rounded-full bg-[#f2f2f2]">
            <MessageCircle className="size-[19px]" />
          </span>
          <span className="flex size-[40px] items-center justify-center rounded-full bg-[#f2f2f2]">
            <Bell className="size-[19px]" />
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      <nav className="relative h-[83px] border-t border-[#e5e7eb] bg-white">
        <div className="flex h-[52px] items-stretch text-[10.5px] font-semibold text-[#14201e]/70">
          {[Home, ShoppingBag].map((I, i) => (
            <span key={i} className={cn("flex flex-1 flex-col items-center justify-center gap-[2px]", i === 0 && "text-[#147c73]")}>
              <I className="size-[24px]" strokeWidth={i === 0 ? 2.4 : 1.8} />
              {i === 0 ? "Home" : "For Sale"}
            </span>
          ))}
          <span className="flex flex-1 items-center justify-center">
            <span className="flex size-[48px] items-center justify-center rounded-full bg-[#147c73] text-white">
              <Plus className="size-[24px]" />
            </span>
          </span>
          {[AlertTriangle, Menu].map((I, i) => (
            <span key={i} className="flex flex-1 flex-col items-center justify-center gap-[2px]">
              <I className="size-[24px]" strokeWidth={1.8} />
              {i === 0 ? "Alerts" : "More"}
            </span>
          ))}
        </div>
        <IOSHomeIndicator />
      </nav>
    </div>
  );
}

function BusinessAvatar({ icon: Icon, tone }: { icon: typeof Utensils; tone: string }) {
  return (
    <span className={cn("flex size-[40px] shrink-0 items-center justify-center rounded-full text-white", tone)}>
      <Icon className="size-[20px]" />
    </span>
  );
}

function FoodPlate() {
  // A stylised party-jollof tray, drawn in CSS so no stock photo is needed.
  return (
    <div className="relative h-[210px] overflow-hidden bg-[radial-gradient(circle_at_30%_30%,#ffb46b,#e8702a_45%,#b8431a)]">
      <div className="absolute top-[30px] left-[40px] size-[150px] rounded-full bg-[radial-gradient(circle,#f28c38,#d9531e)] shadow-[inset_0_-10px_30px_rgba(0,0,0,0.25),0_10px_30px_rgba(0,0,0,0.25)] ring-[10px] ring-white/90" />
      <div className="absolute top-[60px] right-[40px] size-[110px] rounded-full bg-[radial-gradient(circle,#8a4b26,#5b2e14)] shadow-[0_10px_30px_rgba(0,0,0,0.25)] ring-[8px] ring-white/90" />
      <div className="absolute right-[120px] bottom-[18px] size-[70px] rounded-full bg-[radial-gradient(circle,#7ec850,#3f8a2a)] ring-[6px] ring-white/90" />
      <span className="absolute bottom-[12px] left-[14px] rounded-full bg-white/90 px-[10px] py-[4px] text-[12px] font-bold text-[#b8431a]">
        Weekend party packs
      </span>
    </div>
  );
}

/** A free Business Post in the neighbourhood feed. */
export function BusinessPostScreen() {
  return (
    <AppChrome>
      <div className="space-y-[12px] p-[12px]">
        <article className="overflow-hidden rounded-[16px] border border-[#e5e7eb] bg-white">
          <div className="flex items-center gap-[10px] p-[14px]">
            <BusinessAvatar icon={Utensils} tone="bg-[#e8702a]" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-[4px] text-[15px] font-bold">
                Mama Tee&apos;s Kitchen <BadgeCheck className="size-[15px] text-[#147c73]" />
                <span className="flex items-center gap-[2px] text-[12.5px] font-semibold text-[#147c73]">
                  <ThumbsUp className="size-[12px]" /> 57
                </span>
              </p>
              <p className="text-[12.5px] text-[#5b6663]">Business · Lekki Phase 1 · 2h</p>
            </div>
            <span className="text-[18px] leading-none text-[#5b6663]">···</span>
          </div>
          <FoodPlate />
          <p className="p-[14px] text-[14.5px] leading-[1.45]">
            Jollof, fried rice, chicken and small chops trays for your owambe this weekend 🎉 Order by Thursday and get
            10% off for Lekki Phase 1 neighbours.
          </p>
          <div className="flex items-center gap-[6px] border-t border-[#e5e7eb] px-[14px] py-[10px] text-[13.5px] font-semibold text-[#5b6663]">
            <span>❤️🙌 34</span>
            <span className="ml-auto flex items-center gap-[6px]">
              <ThumbsUp className="size-[16px]" /> Like
            </span>
            <span className="flex items-center gap-[6px] pl-[12px]">
              <MessageCircle className="size-[16px]" /> 12
            </span>
            <Share2 className="ml-[12px] size-[16px]" />
          </div>
        </article>
        <article className="rounded-[16px] border border-[#e5e7eb] bg-white p-[14px]">
          <div className="flex items-center gap-[10px]">
            <span className="flex size-[40px] items-center justify-center rounded-full bg-[#e6f1ef] text-[14px] font-bold text-[#147c73]">NF</span>
            <div>
              <p className="text-[15px] font-bold">Ngozi Fashola</p>
              <p className="text-[12.5px] text-[#5b6663]">Lekki Phase 1 · 3h · Recommendation</p>
            </div>
          </div>
          <p className="mt-[10px] text-[14.5px] leading-[1.45]">
            Mama Tee did the small chops for my daughter&apos;s birthday on Saturday. Everything was hot, on time and
            the puff-puff finished first 😂 Highly recommend!
          </p>
          <div className="mt-[10px] flex items-center gap-[10px] rounded-[12px] bg-[#f4f5f4] p-[10px]">
            <BusinessAvatar icon={Utensils} tone="bg-[#e8702a]" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold">Mama Tee&apos;s Kitchen</p>
              <p className="text-[12.5px] font-semibold text-[#147c73]">Recommended by 57 neighbours</p>
            </div>
          </div>
        </article>
      </div>
    </AppChrome>
  );
}

/** Neighbours recommending a business in a thread. */
export function RecommendationScreen() {
  const replies = [
    { initials: "EN", name: "Emeka Nwosu", text: "Femi Electricals, 100%. Fixed my inverter wiring same day and didn't overcharge." },
    { initials: "AO", name: "Adaeze Okafor", text: "+1 for Femi. Very honest, he even told me what NOT to buy 😄" },
    { initials: "TB", name: "Tunde Bakare", text: "Used him for our whole block on Road 12. Reliable." },
  ];
  return (
    <AppChrome title="Post">
      <div className="space-y-[10px] p-[12px]">
        <div className="rounded-[16px] border border-[#e5e7eb] bg-white p-[14px]">
          <div className="flex items-center gap-[10px]">
            <span className="flex size-[40px] items-center justify-center rounded-full bg-[#e6f1ef] text-[14px] font-bold text-[#147c73]">CE</span>
            <div>
              <p className="text-[15px] font-bold">Chidinma Eze</p>
              <p className="text-[12.5px] text-[#5b6663]">Lekki Phase 1 · 3h · Recommendation</p>
            </div>
          </div>
          <p className="mt-[10px] text-[15px] leading-[1.45]">
            Please, who knows a reliable electrician? My inverter keeps tripping 😩
          </p>
        </div>
        <div className="flex items-center gap-[10px] rounded-[16px] border-2 border-[#147c73]/30 bg-[#147c73]/5 p-[12px]">
          <BusinessAvatar icon={Zap} tone="bg-[#147c73]" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-[4px] text-[15px] font-bold">
              Femi Electricals <BadgeCheck className="size-[15px] text-[#147c73]" />
            </p>
            <p className="text-[12.5px] font-semibold text-[#147c73]">Recommended by 23 neighbours</p>
          </div>
          <span className="rounded-full bg-[#147c73] px-[12px] py-[6px] text-[12.5px] font-bold text-white">View</span>
        </div>
        {replies.map((r) => (
          <div key={r.name} className="flex gap-[10px]">
            <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[#e6f1ef] text-[12px] font-bold text-[#147c73]">
              {r.initials}
            </span>
            <div className="rounded-[16px] bg-white px-[12px] py-[9px]">
              <p className="text-[13.5px] font-bold">{r.name}</p>
              <p className="text-[14px] leading-[1.4] text-[#14201e]/90">{r.text}</p>
            </div>
          </div>
        ))}
        <div className="flex gap-[10px]">
          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[#e6f1ef] text-[12px] font-bold text-[#147c73]">IM</span>
          <div className="rounded-[16px] bg-white px-[12px] py-[9px]">
            <p className="text-[13.5px] font-bold">Ibrahim Musa</p>
            <p className="text-[14px] leading-[1.4] text-[#14201e]/90">Femi sorted my changeover switch last month. Good work 👍</p>
          </div>
        </div>
        <div className="flex items-center gap-[8px] pt-[4px]">
          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[#147c73] text-[12px] font-bold text-white">AO</span>
          <span className="flex h-[40px] flex-1 items-center rounded-full border border-[#e5e7eb] bg-white px-[14px] text-[14px] text-[#737373]">
            Add a comment…
          </span>
        </div>
      </div>
    </AppChrome>
  );
}

/** The free Business Page (the business's shopfront on myHoodora). */
export function BusinessPageScreen() {
  return (
    <AppChrome title="Business">
      <div>
        <div className="h-[110px] bg-[linear-gradient(135deg,#147c73,#0e5a53)]" />
        <div className="-mt-[36px] space-y-[12px] px-[16px] pb-[16px]">
          <span className="flex size-[72px] items-center justify-center rounded-[20px] bg-white text-[#147c73] shadow-md ring-4 ring-white">
            <Zap className="size-[34px]" />
          </span>
          <div>
            <p className="flex items-center gap-[6px] text-[21px] font-bold">
              Femi Electricals <BadgeCheck className="size-[20px] text-[#147c73]" />
            </p>
            <p className="text-[14px] text-[#5b6663]">Electrician · Serves Lekki Phase 1, Ikoyi, VI</p>
            <p className="mt-[4px] flex items-center gap-[6px] text-[14px] font-semibold text-[#147c73]">
              <ThumbsUp className="size-[15px]" /> Recommended by 23 neighbours
            </p>
          </div>
          <div className="flex gap-[8px]">
            <span className="flex h-[40px] flex-1 items-center justify-center gap-[6px] rounded-full bg-[#147c73] text-[14px] font-bold text-white">
              <MessageCircle className="size-[16px]" /> Message
            </span>
            <span className="flex h-[40px] flex-1 items-center justify-center gap-[6px] rounded-full border border-[#e5e7eb] bg-white text-[14px] font-bold">
              <Phone className="size-[16px]" /> Call
            </span>
          </div>
          <div className="space-y-[8px] rounded-[16px] border border-[#e5e7eb] bg-white p-[14px] text-[14px]">
            <p className="font-bold">Services</p>
            <div className="flex flex-wrap gap-[6px]">
              {["Inverter & solar", "House wiring", "Generator changeover", "Fault finding"].map((s) => (
                <span key={s} className="rounded-full bg-[#f2f2f2] px-[10px] py-[4px] text-[13px]">
                  {s}
                </span>
              ))}
            </div>
            <p className="flex items-center gap-[6px] pt-[4px] text-[#5b6663]">
              <Clock className="size-[15px]" /> Mon–Sat · 8am – 7pm
            </p>
          </div>
          <div className="rounded-[16px] border border-[#e5e7eb] bg-white p-[14px]">
            <p className="text-[14px] font-bold">What neighbours say</p>
            <p className="mt-[6px] text-[14px] leading-[1.4] text-[#14201e]/90">
              &ldquo;Fixed my inverter wiring same day and didn&apos;t overcharge.&rdquo;
            </p>
            <p className="mt-[4px] text-[12.5px] text-[#5b6663]">Emeka N. · Lekki Phase 1</p>
          </div>
        </div>
      </div>
    </AppChrome>
  );
}

/** A sponsored Local Ad (coming soon). */
export function SponsoredScreen() {
  return (
    <AppChrome>
      <div className="space-y-[12px] p-[12px]">
        <article className="overflow-hidden rounded-[16px] border border-[#e5e7eb] bg-white">
          <div className="flex items-center gap-[10px] p-[14px]">
            <BusinessAvatar icon={Wrench} tone="bg-[#1d4ed8]" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold">CoolBreeze AC Services</p>
              <p className="text-[12.5px] text-[#5b6663]">Sponsored · Serving Lekki &amp; Ajah</p>
            </div>
          </div>
          <div className="flex h-[200px] flex-col items-start justify-end gap-[6px] bg-[linear-gradient(135deg,#1d4ed8,#60a5fa)] p-[16px] text-white">
            <p className="text-[26px] leading-tight font-bold">Beat the heat ☀️</p>
            <p className="text-[15px]">AC servicing from ₦12,000</p>
          </div>
          <div className="flex items-center justify-between p-[14px]">
            <p className="text-[14px]">Book a technician for this week</p>
            <span className="rounded-full bg-[#14201e] px-[14px] py-[7px] text-[13px] font-bold text-white">Book now</span>
          </div>
        </article>
      </div>
    </AppChrome>
  );
}

