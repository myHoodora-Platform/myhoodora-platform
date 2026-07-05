"use client";

import { motion } from "framer-motion";
import { Bell, MapPin, ShoppingBag } from "lucide-react";

const features = [
  {
    title: "Geo-Verified Hoods",
    description: "Join trusted neighbourhood circles based on where you live.",
    icon: MapPin,
  },
  {
    title: "Neighbour Updates",
    description:
      "Share community updates, safety alerts, and local happenings in real time.",
    icon: Bell,
  },
  {
    title: "Local Marketplace",
    description:
      "Buy, sell, and discover nearby services from people and businesses around you.",
    icon: ShoppingBag,
  },
];

export function ComingSoon() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-14 text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(20,124,115,0.14),_transparent_60%)]" />

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center text-center"
      >
        <p className="mb-4 inline-flex rounded-full border border-brand-teal/25 bg-brand-teal/10 px-4 py-1 text-xs font-semibold tracking-[0.18em] text-brand-teal uppercase">
          myHoodora
        </p>

        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
          Your neighbourhood, connected
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          myHoodora is a hyper-local community platform built for Nigeria, where
          neighbours connect through trusted Hoods to stay informed, support one
          another, and discover what matters nearby.
        </p>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
          }}
          className="mt-10 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {features.map(({ title, description, icon: Icon }) => (
            <motion.article
              key={title}
              variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="rounded-2xl border border-border bg-card p-6 text-left shadow-sm"
            >
              <div className="mb-4 inline-flex rounded-xl bg-brand-teal/10 p-3 text-brand-teal">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-semibold text-card-foreground">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </motion.article>
          ))}
        </motion.div>

        <motion.button
          type="button"
          whileHover={{ y: -2, scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 360, damping: 24 }}
          className="mt-10 inline-flex items-center justify-center rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-sm"
        >
          Launching Soon
        </motion.button>
      </motion.section>
    </main>
  );
}
