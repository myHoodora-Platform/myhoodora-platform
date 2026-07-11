"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Home, Compass } from "lucide-react";
import { motion } from "framer-motion";

export default function NotFound() {
    const router = useRouter();

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground font-sans px-6 text-center space-y-8">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="space-y-6 flex flex-col items-center"
            >
                <div className="size-24 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Compass className="size-12" />
                </div>

                <h1 className="text-7xl lg:text-9xl font-black text-foreground tracking-tight drop-shadow-sm">404</h1>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Looks like you&apos;re lost in the neighborhood</h2>
                <p className="text-muted-foreground max-w-md mx-auto text-lg leading-relaxed">
                    The page you are looking for doesn&apos;t exist or has been moved. Let&apos;s get you back to familiar streets.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6 w-full max-w-md">
                    <button
                        onClick={() => router.back()}
                        className="w-full flex items-center justify-center gap-2 bg-background border-2 border-border text-foreground font-bold py-3 px-6 rounded-xl hover:bg-muted transition-all active:scale-95"
                    >
                        <ArrowLeft className="size-5" />
                        Go Back
                    </button>

                    <Link href="/" className="w-full">
                        <button className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold py-3 px-6 rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95">
                            <Home className="size-5" />
                            Return Home
                        </button>
                    </Link>
                </div>
            </motion.div>
        </div>
    );
}
