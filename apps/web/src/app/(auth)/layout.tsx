import React from "react";
import { MascotLockup } from "@myhoodora/ui/logo";
import { Header } from "@/components/layout/Header";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 text-foreground font-sans">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-12 md:py-16">
        <div className="w-full max-w-md bg-white/95 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-border/80">
          <MascotLockup size="sm" className="block mx-auto mb-6" />
          {children}
        </div>
      </main>
    </div>
  );
}
