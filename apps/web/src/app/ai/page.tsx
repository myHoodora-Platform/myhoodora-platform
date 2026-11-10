import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/site";
import Image from "next/image";
import {
  Briefcase,
  Check,
  FileText,
  GraduationCap,
  School,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { ExploreMore } from "@/components/marketing/explore-more";
import { MarketingPage } from "@/components/marketing/marketing-page";
import { HOODORA_AI_LOGO } from "@/lib/site-images";

export const metadata: Metadata = publicPageMetadata("/ai", {
  title: "myHoodora AI | Turn lectures into personalized content for your students",
  description:
    "Upload your slides or notes once. myHoodora AI turns them into personalized learning experiences, reviewed by you before students see them.",
});

const container = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

const STATS = [
  { value: "1 → ∞", label: "One upload, various ways to learn" },
  { value: "< 30 min", label: "From lecture notes to finished assets" },
  { value: "100%", label: "Reviewed by you before students see it" },
  { value: "PDF · DOCX · PPTX", label: "Works with the material you already have" },
];

const AUDIENCES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: School, title: "Primary & secondary schools", body: "Make revision something pupils ask for, from Basic Science to Civic Education." },
  { icon: GraduationCap, title: "Lecturers & instructional designers", body: "Turn dense course packs into microlearning your students actually finish." },
  { icon: Briefcase, title: "Course platforms & L&D teams", body: "Add engaging content to every module without a studio." },
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
    a: "Personalized learning experiences tailored to your students' needs, reviewed by you before they see them.",
  },
  {
    q: "How long does it take?",
    a: "Our target is under 30 minutes per lecture. It runs in the background, so you can upload and come back when it's ready.",
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
            <p className="inline-flex items-center gap-2 rounded-full bg-brand-coral/10 px-3 py-1 text-xs font-bold tracking-wide text-brand-coral-ink uppercase">
              <Sparkles className="size-3.5" aria-hidden /> New from myHoodora · Pilot
            </p>
            <h1 className="text-4xl leading-[1.05] font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Turn any lecture into personalized learning experiences
            </h1>
            <p className="mx-auto max-w-xl text-lg leading-relaxed text-muted-foreground lg:mx-0">
              Upload your slides or notes once. myHoodora AI turns them into personalized learning experiences, reviewed by you before students see them.
            </p>
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
              content tailored to their learning styles, showing the idea instead of describing it.
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
                <li>Personalized learning experiences tailored to each student</li>
                <li>Revision students choose to do</li>
                <li>Ready in minutes, checked by you</li>
              </ul>
            </div>
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

      <ExploreMore items={["about", "business", "safety"]} title="Part of the myHoodora family" className="bg-canvas" />
    </MarketingPage>
  );
}
