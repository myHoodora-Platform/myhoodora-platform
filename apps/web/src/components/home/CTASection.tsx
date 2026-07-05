"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export function CTASection() {
    return (
        <section className="py-20 px-6 lg:px-20 mb-10">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="max-w-5xl mx-auto rounded-[2rem] bg-primary p-12 lg:p-20 text-center relative overflow-hidden"
            >
                <div className="absolute inset-0 opacity-10">
                    <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                        <path d="M0 100 C 20 0 50 0 100 100 Z" fill="white" />
                    </svg>
                </div>
                <div className="relative z-10 space-y-8">
                    <h2 className="text-4xl lg:text-5xl font-black text-primary-foreground leading-tight">
                        Ready to meet your neighbors?
                    </h2>
                    <p className="text-primary-foreground/90 text-lg max-w-xl mx-auto">
                        Join millions of neighbors already using myHoodora to build stronger, safer, and more connected communities.
                    </p>
                    <div className="pt-4">
                        <Link href="/register">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="bg-background text-primary font-black py-5 px-12 rounded-2xl hover:bg-slate-100 transition-all text-lg shadow-xl"
                            >
                                Get started for free
                            </motion.button>
                        </Link>
                    </div>
                </div>
            </motion.div>
        </section>
    );
}
