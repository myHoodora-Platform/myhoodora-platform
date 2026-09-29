import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Briefcase,
  Check,
  Clapperboard,
  FileText,
  Gamepad2,
  GraduationCap,
  Music2,
  Pause,
  PencilLine,
  Quote,
  RefreshCw,
  School,
  Sparkles,
  Upload,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { ExploreMore } from "@/components/marketing/explore-more";
import { MarketingPage } from "@/components/marketing/marketing-page";
import { AiPilotForm } from "@/features/hoodora-ai/pilot-form";
import { HOODORA_AI_LOGO } from "@/lib/site-images";

export const metadata: Metadata = {
  title: "myHoodora AI | Turn lectures into songs, games and videos",
  description:
    "Upload your slides or notes once. myHoodora AI turns them into a catchy song, a playable learning game and a short explainer video, reviewed by you before students see them.",
};

const container = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

const STATS = [
  { value: "1 → 3", label: "One upload, three ways to learn" },
  { value: "< 30 min", label: "From lecture notes to finished assets" },
  { value: "100%", label: "Reviewed by you before students see it" },
  { value: "PDF · DOCX · PPTX", label: "Works with the material you already have" },
];

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Upload, title: "Upload your material", body: "Slides, PDFs, Word notes or a lecture transcript. No reformatting needed." },
  { icon: BookOpenCheck, title: "We find what matters", body: "Topics, key definitions and the facts worth remembering, all linked back to your source." },
  { icon: Wand2, title: "Three formats, in parallel", body: "A song, a game and a video are generated at the same time from the same content brief." },
  { icon: PencilLine, title: "You review and publish", body: "Check every fact, tweak or regenerate anything, then download or share with your class." },
];

const AUDIENCES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: School, title: "Primary & secondary schools", body: "Make revision something pupils ask for, from Basic Science to Civic Education." },
  { icon: GraduationCap, title: "Lecturers & instructional designers", body: "Turn dense course packs into microlearning your students actually finish." },
  { icon: Briefcase, title: "Course platforms & L&D teams", body: "Add engaging song, game and video versions to every module without a studio." },
];

const FAQS = [
  {
    q: "How accurate is the content?",
    a: "Every fact the engine uses is traced back to the exact place in your material, so you can check it in seconds. Nothing is published until you approve it, and you can edit or regenerate any part.",
  },
  {
    q: "What can I upload?",
    a: "PDF, Word (DOCX) and PowerPoint (PPTX) files, or a plain-text lecture transcript. Video and audio recordings aren't supported in the first version.",
  },
  {
    q: "What exactly do I get back?",
    a: "A 30–90 second song with a lyric sheet (MP3/WAV), a browser game (quiz, flashcards or matching pairs) with a shareable link, and a 60–120 second narrated explainer video (MP4).",
  },
  {
    q: "How long does it take?",
    a: "Our target is under 30 minutes per lecture. It runs in the background, so you can upload and come back when it's ready.",
  },
  {
    q: "When can my school use it?",
    a: "myHoodora AI is in development and we're opening a pilot with a small group of schools and lecturers. Join the waitlist below and we'll be in touch.",
  },
];

export default function HoodoraAiPage() {
  return (
    <MarketingPage>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-gradient-to-b from-canvas to-background">
        <span aria-hidden className="absolute -top-32 -right-32 -z-10 size-[28rem] rounded-full bg-brand-coral/10 blur-3xl" />
        <span aria-hidden className="absolute top-40 -left-40 -z-10 size-[26rem] rounded-full bg-primary/10 blur-3xl" />
        <div className={`${container} grid items-center gap-12 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24`}>
          <div className="space-y-6 text-center lg:text-left">
            <p className="inline-flex items-center gap-2 rounded-full bg-brand-coral/10 px-3 py-1 text-xs font-bold tracking-wide text-brand-coral uppercase">
              <Sparkles className="size-3.5" aria-hidden /> New from myHoodora · Pilot
            </p>
            <h1 className="text-4xl leading-[1.05] font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Turn any lecture into a <span className="text-brand-coral">song</span>, a{" "}
              <span className="text-primary">game</span> and a <span className="text-brand-coral">video</span>
            </h1>
            <p className="mx-auto max-w-xl text-lg leading-relaxed text-muted-foreground lg:mx-0">
              Upload your slides or notes once. myHoodora AI turns them into learning your students will actually replay,
              and you check every fact before anyone sees it.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Link
                href="#pilot"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 font-bold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
              >
                Join the pilot <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="#how"
                className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-background px-6 font-semibold transition-colors hover:bg-muted"
              >
                See how it works
              </Link>
            </div>
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground lg:justify-start">
              {["Learn", "Practice", "Grow"].map((t) => (
                <li key={t} className="flex items-center gap-1.5 font-semibold">
                  <Check className="size-4 text-primary" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="overflow-hidden rounded-[2rem] border border-border bg-[#f3f3f3] shadow-[0_40px_80px_-40px_rgba(20,124,115,0.55)]">
              <Image src={HOODORA_AI_LOGO} alt="myHoodora AI" width={900} height={900} priority className="h-auto w-full" />
            </div>
            <FloatingChip className="-left-4 top-10 sm:-left-10" icon={Music2} tone="coral" title="Song" meta="0:58 · lyric sheet" />
            <FloatingChip className="top-1/2 -right-3 sm:-right-10" icon={Gamepad2} tone="teal" title="Game" meta="10 questions" />
            <FloatingChip className="-bottom-6 right-6 sm:right-10" icon={Clapperboard} tone="dark" title="Video" meta="1:45 · narrated" />
          </div>
        </div>
      </section>

      {/* ── Numbers ──────────────────────────────────────────────────────── */}
      <section className="border-y border-border bg-card">
        <dl className={`${container} grid grid-cols-2 gap-6 py-10 lg:grid-cols-4`}>
          {STATS.map((s) => (
            <div key={s.label} className="text-center lg:text-left">
              <dt className="sr-only">{s.label}</dt>
              <dd className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">{s.value}</dd>
              <dd className="mt-1 text-sm text-muted-foreground">{s.label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Problem ─────────────────────────────────────────────────────── */}
      <section className="py-16 lg:py-24">
        <div className={`${container} grid gap-10 lg:grid-cols-2 lg:items-center`}>
          <div className="space-y-4">
            <p className="text-sm font-bold tracking-wide text-primary uppercase">Why myHoodora AI</p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Great teaching, stuck in 60 slides of text</h2>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Course material is dense and passive to read. Students remember far more when the same ideas come back as a
              tune they can hum, a game they want to win, or a short video that shows the idea instead of describing it.
            </p>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Making those by hand takes days. myHoodora AI does it from the material you already have.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-border bg-muted/50 p-6">
              <FileText className="size-7 text-muted-foreground" aria-hidden />
              <p className="mt-4 font-bold">Before</p>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                <li>Text-heavy slides and PDFs</li>
                <li>Read once, forgotten by exams</li>
                <li>Days to build anything more engaging</li>
              </ul>
            </div>
            <div className="rounded-3xl bg-primary p-6 text-primary-foreground shadow-lg">
              <Sparkles className="size-7" aria-hidden />
              <p className="mt-4 font-bold">After</p>
              <ul className="mt-2 space-y-1.5 text-sm text-primary-foreground/85">
                <li>A song, a game and a video per lecture</li>
                <li>Revision students choose to do</li>
                <li>Ready in minutes, checked by you</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Three outputs ───────────────────────────────────────────────── */}
      <section className="bg-canvas py-16 lg:py-24">
        <div className={container}>
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <p className="text-sm font-bold tracking-wide text-primary uppercase">One lecture in</p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Three ways to learn out</h2>
            <p className="text-lg text-muted-foreground">
              Here&apos;s what a single JSS2 Basic Science lesson on <span className="font-semibold text-foreground">photosynthesis</span>{" "}
              becomes.
            </p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            <OutputCard
              icon={Music2}
              tone="coral"
              title="A song they can't forget"
              body="Key facts and definitions written into lyrics, then sung or rapped with an AI voice. 30–90 seconds, with a lyric sheet."
              format="MP3 / WAV + lyrics"
            >
              <SongPreview />
            </OutputCard>
            <OutputCard
              icon={Gamepad2}
              tone="teal"
              title="A game worth winning"
              body="Quiz show, flashcards or matching pairs, built from your facts and playable in any browser. Share it with a link."
              format="Web game + share link"
            >
              <GamePreview />
            </OutputCard>
            <OutputCard
              icon={Clapperboard}
              tone="dark"
              title="A video that shows it"
              body="A 60–120 second narrated explainer with motion graphics that follow the story of your lesson."
              format="MP4 video"
            >
              <VideoPreview />
            </OutputCard>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section id="how" className="scroll-mt-20 py-16 lg:py-24">
        <div className={container}>
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <p className="text-sm font-bold tracking-wide text-primary uppercase">How it works</p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Upload once. We handle the rest.</h2>
          </div>
          <ol className="relative mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <span aria-hidden className="absolute top-7 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-primary/40 via-brand-coral/40 to-primary/40 lg:block" />
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative text-center">
                <span className="relative mx-auto flex size-14 items-center justify-center rounded-2xl bg-card text-primary shadow-md ring-1 ring-border">
                  <s.icon className="size-6" aria-hidden />
                  <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-brand-coral text-xs font-bold text-white">
                    {i + 1}
                  </span>
                </span>
                <h3 className="mt-5 text-lg font-bold">{s.title}</h3>
                <p className="mt-1 text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Control & accuracy ──────────────────────────────────────────── */}
      <section className="bg-canvas py-16 lg:py-24">
        <div className={`${container} grid items-center gap-12 lg:grid-cols-2`}>
          <ReviewPreview />
          <div className="space-y-5">
            <p className="text-sm font-bold tracking-wide text-primary uppercase">You stay in control</p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Every fact traced back to your notes</h2>
            <p className="text-lg leading-relaxed text-muted-foreground">
              AI is fast, but you know your subject. Before anything is published, you see each fact next to the line it
              came from in your material.
            </p>
            <ul className="space-y-3">
              {[
                [Quote, "Source-linked facts you can check in seconds"],
                [PencilLine, "Edit lyrics, questions or narration directly"],
                [RefreshCw, "Regenerate any one output without redoing the rest"],
                [Check, "Nothing goes to students until you approve it"],
              ].map(([Icon, label]) => {
                const I = Icon as LucideIcon;
                return (
                  <li key={label as string} className="flex items-center gap-3 font-medium">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <I className="size-4" aria-hidden />
                    </span>
                    {label as string}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Who it's for ────────────────────────────────────────────────── */}
      <section className="py-16 lg:py-24">
        <div className={container}>
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">Built for the people who teach</h2>
          <ul className="mt-10 grid gap-4 md:grid-cols-3">
            {AUDIENCES.map((a) => (
              <li key={a.title} className="rounded-3xl border border-border bg-card p-6 transition-shadow hover:shadow-md">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <a.icon className="size-6" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-bold">{a.title}</h3>
                <p className="mt-1 text-muted-foreground">{a.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section className="bg-canvas py-16 lg:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight">Questions from educators</h2>
          <div className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card">
            {FAQS.map((f) => (
              <details key={f.q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold marker:hidden">
                  {f.q}
                  <span aria-hidden className="text-2xl leading-none text-muted-foreground transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="px-5 pb-5 leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pilot waitlist ──────────────────────────────────────────────── */}
      <section id="pilot" className="scroll-mt-20 py-16 lg:py-24">
        <div className={`${container} grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center`}>
          <div className="space-y-5">
            <p className="inline-flex items-center gap-2 rounded-full bg-brand-coral/10 px-3 py-1 text-xs font-bold tracking-wide text-brand-coral uppercase">
              <Sparkles className="size-3.5" aria-hidden /> Limited pilot places
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">Bring myHoodora AI to your classroom</h2>
            <p className="text-lg leading-relaxed text-muted-foreground">
              We&apos;re starting with a small group of schools and lecturers in Nigeria. Pilot partners get early access,
              hands-on help with their first lectures, and a say in what we build next.
            </p>
            <ul className="space-y-2">
              {["Early access before public launch", "Help converting your first lectures", "Shape the roadmap with us"].map((t) => (
                <li key={t} className="flex items-center gap-3 font-medium">
                  <Check className="size-5 shrink-0 text-primary" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
          <AiPilotForm />
        </div>
      </section>

      <ExploreMore items={["about", "business", "safety"]} title="Part of the myHoodora family" className="bg-canvas" />
    </MarketingPage>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

const TONES = {
  coral: { chip: "bg-brand-coral text-white", soft: "bg-brand-coral/10 text-brand-coral" },
  teal: { chip: "bg-primary text-primary-foreground", soft: "bg-primary/10 text-primary" },
  dark: { chip: "bg-slate-900 text-white", soft: "bg-slate-900/10 text-slate-900 dark:bg-white/10 dark:text-white" },
} as const;

function FloatingChip({
  icon: Icon,
  tone,
  title,
  meta,
  className,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  title: string;
  meta: string;
  className: string;
}) {
  return (
    <div aria-hidden className={`absolute flex items-center gap-3 rounded-2xl border border-border bg-card/95 px-3 py-2.5 shadow-xl backdrop-blur ${className}`}>
      <span className={`flex size-9 items-center justify-center rounded-xl ${TONES[tone].chip}`}>
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs text-muted-foreground">{meta}</span>
      </span>
    </div>
  );
}

function OutputCard({
  icon: Icon,
  tone,
  title,
  body,
  format,
  children,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  title: string;
  body: string;
  format: string;
  children: React.ReactNode;
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="bg-muted/40 p-5">{children}</div>
      <div className="flex flex-1 flex-col gap-2 p-6">
        <span className={`flex size-10 items-center justify-center rounded-xl ${TONES[tone].chip}`}>
          <Icon className="size-5" aria-hidden />
        </span>
        <h3 className="mt-2 text-xl font-bold tracking-tight">{title}</h3>
        <p className="flex-1 text-muted-foreground">{body}</p>
        <p className={`mt-2 w-fit rounded-full px-3 py-1 text-xs font-bold ${TONES[tone].soft}`}>{format}</p>
      </div>
    </article>
  );
}

/** Mini lyric player. */
function SongPreview() {
  const bars = [30, 55, 80, 45, 90, 60, 35, 70, 95, 50, 40, 75, 60, 85, 45, 30, 65, 90, 55, 35];
  return (
    <div aria-hidden className="rounded-2xl bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-brand-coral text-white">
          <Pause className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">The Green Kitchen</p>
          <p className="text-xs text-muted-foreground">Photosynthesis · Afrobeats · 0:58</p>
        </div>
      </div>
      <div className="mt-4 flex h-10 items-end gap-[3px]">
        {bars.map((h, i) => (
          <span key={i} className={`flex-1 rounded-full ${i < 9 ? "bg-brand-coral" : "bg-border"}`} style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="mt-4 space-y-1 text-sm leading-snug">
        <p className="text-muted-foreground">Sunlight, water, carbon dioxide,</p>
        <p className="font-semibold text-foreground">chlorophyll dey cook am inside 🎶</p>
        <p className="text-muted-foreground">Glucose for the plant, oxygen for you…</p>
      </div>
    </div>
  );
}

/** Mini quiz game. */
function GamePreview() {
  const options = [
    { t: "Mitochondria", s: "idle" },
    { t: "Chloroplast", s: "right" },
    { t: "Nucleus", s: "idle" },
    { t: "Cell wall", s: "idle" },
  ] as const;
  return (
    <div aria-hidden className="rounded-2xl bg-primary p-4 text-primary-foreground shadow-sm">
      <div className="flex items-center justify-between text-xs font-bold">
        <span>Question 3 of 10</span>
        <span className="rounded-full bg-white/20 px-2 py-0.5">⭐ 240</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-white/20">
        <span className="block h-full w-[30%] rounded-full bg-brand-coral" />
      </div>
      <p className="mt-4 text-sm font-bold">Where in the leaf does photosynthesis happen?</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {options.map((o) => (
          <span
            key={o.t}
            className={`rounded-xl px-3 py-2 text-center text-xs font-semibold ${
              o.s === "right" ? "bg-white text-primary ring-2 ring-brand-coral" : "bg-white/15"
            }`}
          >
            {o.s === "right" && "✓ "}
            {o.t}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Mini video player. */
function VideoPreview() {
  return (
    <div aria-hidden className="overflow-hidden rounded-2xl bg-slate-900 text-white shadow-sm">
      <div className="relative aspect-video bg-gradient-to-br from-primary via-[#0f5f58] to-slate-900 p-4">
        <span className="absolute top-3 right-3 rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-bold">Scene 2 / 6</span>
        <div className="flex h-full items-center justify-center gap-3">
          <span className="text-3xl">☀️</span>
          <span className="text-lg font-bold">+</span>
          <span className="text-3xl">💧</span>
          <span className="text-lg font-bold">+</span>
          <span className="text-2xl font-bold">CO₂</span>
          <span className="text-lg font-bold">→</span>
          <span className="text-3xl">🌿</span>
        </div>
        <p className="absolute inset-x-4 bottom-3 text-center text-[11px] font-medium text-white/90">
          “Leaves are the plant&apos;s kitchen. Sunlight is the fire…”
        </p>
      </div>
      <div className="flex items-center gap-3 px-4 py-3 text-xs">
        <Pause className="size-3.5" />
        <span className="h-1 flex-1 rounded-full bg-white/20">
          <span className="block h-full w-[38%] rounded-full bg-brand-coral" />
        </span>
        <span className="tabular-nums text-white/70">0:40 / 1:45</span>
      </div>
    </div>
  );
}

/** Review dashboard snippet: a fact next to its source line. */
function ReviewPreview() {
  return (
    <div aria-hidden className="rounded-3xl border border-border bg-card p-5 shadow-[0_30px_60px_-30px_rgba(20,124,115,0.45)] sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Review · Photosynthesis</p>
          <p className="text-lg font-bold">Facts used in all 3 outputs</p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">7 / 8 approved</span>
      </div>
      <ul className="mt-5 space-y-3">
        {[
          { fact: "Photosynthesis happens in the chloroplasts.", src: "Slide 4 · “…takes place in the chloroplast, which contains chlorophyll.”", ok: true },
          { fact: "Plants release oxygen as a by-product.", src: "Slide 6 · “Oxygen is given off as a by-product of the reaction.”", ok: true },
          { fact: "Glucose is stored as starch.", src: "Notes p.2 · “Excess glucose is converted to starch for storage.”", ok: false },
        ].map((f) => (
          <li key={f.fact} className="rounded-2xl border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold">{f.fact}</p>
              {f.ok ? (
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3.5" />
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-brand-coral/15 px-2 py-0.5 text-xs font-bold text-brand-coral">Check</span>
              )}
            </div>
            <p className="mt-2 flex gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              <Quote className="mt-0.5 size-3 shrink-0" /> {f.src}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex gap-2">
        <span className="flex-1 rounded-full bg-primary py-2.5 text-center text-sm font-bold text-primary-foreground">Approve & publish</span>
        <span className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold">Regenerate</span>
      </div>
    </div>
  );
}
