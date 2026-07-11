"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";

export function HeroSection() {
    return (
        <section className="relative min-h-[85vh] flex items-center justify-center px-6 lg:px-20 py-12 overflow-hidden">
            {/* Hero Background Image with Overlay */}
            <div className="absolute inset-0 z-0">
                {/* Using Next Image with unoptimized flag to bypass domain restriction for remote images */}
                <Image
                    unoptimized
                    className="w-full h-full object-cover"
                    alt="Sunlit friendly suburban neighborhood street with trees"
                    width={1920}
                    height={1080}
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAZPorGgpykC8rkOoSv9p7pu8IXYGoXjrvnIBz3n6SGvpSTpVS1T2WU4ASBYobokKKwQrH2mIZ5gpqZv3hOfeCBQpxS0uHsqEuO7qnnmZGGf0kJsm9nTf_410sJIuM4x53dm1DnpjlM2NlYKf3Vn0zZIcWfoTdwo5W5jrh93_kULt_thEWbS092el47OO5gmqW4UZo0DGlUImz41DpiaZRQkiqDMM0EKqhw6tTMQfzYoIeJtvXc3LF0HrgzQxwZCeWutrlFIrb6iUg"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/60 to-transparent dark:from-background/95 dark:via-background/70"></div>
            </div>

            <div className="relative z-10 max-w-7xl w-full grid lg:grid-cols-2 gap-12 items-center">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="space-y-6"
                >
                    <h1 className="text-5xl lg:text-7xl font-black tracking-tight leading-tight text-foreground">
                        Discover your <br />
                        <span className="text-primary">neighborhood</span>
                    </h1>
                    <p className="text-lg lg:text-xl text-muted-foreground max-w-lg leading-relaxed">
                        Join your local community to connect with neighbors, stay informed with real-time alerts, and build a safer, friendlier place to live.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 max-w-md pt-4">
                        <div className="flex-1 relative group">
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors size-5" />
                            <input
                                className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-transparent bg-white dark:bg-slate-800 shadow-xl focus:border-primary focus:ring-0 transition-all outline-none text-foreground"
                                placeholder="Enter your address"
                                type="text"
                            />
                        </div>
                        <button className="bg-primary text-primary-foreground font-bold py-4 px-8 rounded-xl hover:bg-primary/90 shadow-xl shadow-primary/25 transition-all whitespace-nowrap">
                            Find my hood
                        </button>
                    </div>
                </motion.div>

                {/* Signup/Auth Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-8 rounded-3xl shadow-2xl border border-border max-w-md w-full ml-auto"
                >
                    <h3 className="text-2xl font-bold mb-2">Welcome to myHoodora</h3>
                    <p className="text-muted-foreground mb-8 text-sm">Choose how you&apos;d like to join your community.</p>

                    <div className="space-y-3">
                        <button className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-background border border-border rounded-xl font-bold hover:bg-muted transition-all text-foreground">
                            <svg className="size-5" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335" />
                            </svg>
                            Continue with Google
                        </button>
                        <button className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-background border border-border rounded-xl font-bold hover:bg-muted transition-all text-foreground">
                            <svg className="size-5 fill-current" viewBox="0 0 24 24">
                                <path d="M17.05 20.28c-.96 0-2.04-.6-3.23-.6-1.16 0-2.22.56-3.12.56-1.44 0-4.39-2.86-4.39-7.07 0-4.23 2.72-6.44 5.33-6.44 1.38 0 2.51.88 3.51.88 1 0 2.44-.94 3.97-.94 1.83 0 3.32.96 4.14 2.21-3.66 1.54-3.08 6.42.54 7.9-1.07 2.76-2.3 3.5-3.15 3.5zm-1.63-14.71c-.81 1.01-2.12 1.67-3.26 1.58-.16-1.18.42-2.49 1.29-3.41.9-.96 2.25-1.55 3.25-1.55.19 1.25-.47 2.37-1.28 3.38z" />
                            </svg>
                            Continue with Apple
                        </button>

                        <div className="flex items-center gap-4 py-2">
                            <div className="h-px flex-1 bg-border"></div>
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">or</span>
                            <div className="h-px flex-1 bg-border"></div>
                        </div>

                        <Link href="/register" className="block w-full">
                            <button className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                                Sign up with Email
                            </button>
                        </Link>
                    </div>

                    <p className="mt-6 text-center text-xs text-muted-foreground leading-relaxed">
                        By signing up, you agree to our <Link className="underline hover:text-primary transition-colors" href="/terms">Terms of Service</Link> and <Link className="underline hover:text-primary transition-colors" href="/privacy">Privacy Policy</Link>.
                    </p>
                </motion.div>
            </div>
        </section>
    );
}
