import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/site";
import { Suspense } from "react";
import { GetStartedFlow, GetStartedHeader } from "@/features/business/get-started";

export const metadata: Metadata = publicPageMetadata("/business/get-started", {
  title: "Create your free Business Page | myHoodora",
  description: "Put your business in front of verified neighbours in Lagos and Ibadan. Free to start.",
});

export default function Page() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas font-sans text-foreground">
      <GetStartedHeader />
      <main className="flex flex-1 justify-center px-4 py-8 sm:px-8 sm:py-12">
        <div className="w-full max-w-xl">
          <Suspense>
            <GetStartedFlow />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
