"use client";

import { motion } from "framer-motion";
import { CheckCircle, BellRing } from "lucide-react";

export function CommunityFeedSection() {
    return (
        <section className="py-24 px-6 lg:px-20 overflow-hidden">
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
                <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="flex-1 space-y-6"
                >
                    <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest rounded-full">
                        Community Feed
                    </span>
                    <h2 className="text-4xl font-bold leading-tight">Your neighborhood at a glance</h2>
                    <p className="text-muted-foreground text-lg leading-relaxed">
                        Stay updated with your community. See where active discussions are happening, find local recommendations, and keep track of community events with our real-time feed.
                    </p>
                    <ul className="space-y-4 pt-4">
                        <li className="flex items-center gap-3">
                            <CheckCircle className="text-primary size-6 shrink-0" />
                            <span className="font-medium">Browse topics like Local Services, Safety, and Events</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <CheckCircle className="text-primary size-6 shrink-0" />
                            <span className="font-medium">Connect and message verified neighbors directly</span>
                        </li>
                    </ul>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="flex-1 w-full relative"
                >
                    <div className="rounded-3xl overflow-hidden shadow-2xl border-8 border-card bg-muted/20 relative aspect-square flex items-center justify-center p-4 sm:p-8">
                        {/* Mockup of a feed instead of an image */}
                        <div className="w-full h-full bg-background rounded-2xl shadow-sm border border-border p-4 sm:p-6 flex flex-col gap-6 overflow-hidden relative">
                            <div className="absolute top-0 left-0 w-full h-16 sm:h-24 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none"></div>
                            <div className="absolute bottom-0 left-0 w-full h-16 sm:h-24 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none"></div>

                            {/* Feed Item 1 */}
                            <div className="flex gap-4 opacity-40 -translate-y-4 blur-[1px]">
                                <div className="size-10 rounded-full bg-primary/20 shrink-0"></div>
                                <div className="space-y-2 flex-1">
                                    <div className="h-4 bg-muted rounded w-1/3"></div>
                                    <div className="h-3 bg-muted rounded w-full"></div>
                                    <div className="h-3 bg-muted rounded w-5/6"></div>
                                </div>
                            </div>

                            {/* Feed Item 2 (Active) */}
                            <div className="flex gap-4 bg-card rounded-xl p-4 sm:p-5 shadow-sm border border-primary/10 relative z-20">
                                <div className="size-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold shrink-0">JD</div>
                                <div className="space-y-3 flex-1">
                                    <div className="flex justify-between items-center text-foreground">
                                        <div className="font-bold text-sm">Jane Doe</div>
                                        <div className="text-xs text-muted-foreground">2 hrs ago</div>
                                    </div>
                                    <p className="text-sm text-foreground">Does anyone know a good plumber in the Oakwood area? Need to fix a leaky pipe ASAP!</p>
                                    <div className="flex gap-4 pt-2">
                                        <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded-full">Recommendations</span>
                                    </div>
                                </div>
                            </div>

                            {/* Feed Item 3 */}
                            <div className="flex gap-4 opacity-70">
                                <div className="size-10 rounded-full bg-primary/20 shrink-0"></div>
                                <div className="space-y-2 flex-1">
                                    <div className="h-4 bg-muted rounded w-1/4"></div>
                                    <div className="h-3 bg-muted rounded w-full"></div>
                                    <div className="h-3 bg-muted rounded w-4/5"></div>
                                </div>
                            </div>

                            {/* Feed Item 4 */}
                            <div className="flex gap-4 opacity-30 translate-y-4 blur-[1px]">
                                <div className="size-10 rounded-full bg-primary/20 shrink-0"></div>
                                <div className="space-y-2 flex-1">
                                    <div className="h-4 bg-muted rounded w-1/3"></div>
                                    <div className="h-3 bg-muted rounded w-full"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Floating Card */}
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        whileInView={{ y: 0, opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.4, type: "spring" }}
                        className="absolute -bottom-6 -left-6 bg-card text-card-foreground p-6 rounded-2xl shadow-xl border border-border hidden sm:block z-30"
                    >
                        <div className="flex items-center gap-4">
                            <div className="size-12 rounded-full bg-green-500/10 flex items-center justify-center">
                                <BellRing className="text-green-600 size-6" />
                            </div>
                            <div>
                                <p className="text-sm font-bold">New recommendation!</p>
                                <p className="text-xs text-muted-foreground">3 neighbors replied</p>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
}
