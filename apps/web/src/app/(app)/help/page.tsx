import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Mail, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/states";
import { SupportForm } from "@/features/help/support-form";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "Help centre | myHoodora" };

const FAQS = [
  {
    q: "Why do I need to verify my address?",
    a: "myHoodora only works if everyone is a real neighbour. Verifying confirms you live in your neighbourhood and unlocks Alerts, Events, Groups and For Sale & Free.",
  },
  {
    q: "Who can see my posts?",
    a: "Verified neighbours in your neighbourhood. Your exact address is never shown, only your neighbourhood name.",
  },
  {
    q: "When should I use an urgent alert?",
    a: "Only for something happening right now that puts neighbours at risk, like a break-in in progress, a fire or dangerous flooding. Urgent alerts show a red banner to everyone for 2 hours.",
  },
  {
    q: "How do I stay safe buying and selling?",
    a: "Meet in a public place such as your estate gate, inspect the item before paying, and never send money to someone you haven't met.",
  },
  {
    q: "How do I report something?",
    a: "Use the ••• menu on any post, or “Report” on comments, listings and messages. Reports are private: volunteer Hood Leads or the myHoodora team review them, and nobody is told who reported. You can see the outcome, and appeal it, in Settings → Decisions & appeals.",
  },
  {
    q: "How do I change my neighbourhood?",
    a: "Moving to a new neighbourhood isn't self-serve yet. Send us a message below and we'll move you over after verifying your new address.",
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Help centre" description="Answers to common questions about myHoodora." />

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href={ROUTES.guidelines} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:bg-muted/50">
          <BookOpen className="size-5 text-primary" aria-hidden />
          <span className="font-semibold">Community guidelines</span>
        </Link>
        <Link href="/privacy" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:bg-muted/50">
          <ShieldCheck className="size-5 text-primary" aria-hidden />
          <span className="font-semibold">Privacy policy</span>
        </Link>
        <a href="#support" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:bg-muted/50">
          <Mail className="size-5 text-primary" aria-hidden />
          <span className="font-semibold">Contact support</span>
        </a>
      </div>

      <section aria-labelledby="faq" className="rounded-2xl border border-border bg-card">
        <h2 id="faq" className="border-b border-border p-4 text-base font-bold">
          Frequently asked questions
        </h2>
        {FAQS.map((f) => (
          <details key={f.q} className="group border-b border-border last:border-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold marker:hidden hover:bg-muted/40">
              {f.q}
              <span aria-hidden className="text-xl text-muted-foreground transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="px-4 pb-4 text-[15px] text-foreground/80">{f.a}</p>
          </details>
        ))}
      </section>

      <section id="support" aria-labelledby="support-title" className="scroll-mt-24 rounded-2xl border border-border bg-card">
        <h2 id="support-title" className="border-b border-border p-4 text-base font-bold">
          Contact support
        </h2>
        <SupportForm />
      </section>
    </div>
  );
}
