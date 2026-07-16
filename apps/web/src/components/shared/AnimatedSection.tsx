"use client";

import { useRef, useEffect } from "react";
import { motion, useAnimationControls, useInView, type Target, type Transition } from "framer-motion";

type AnimatedSectionProps = {
  children: React.ReactNode;
  className?: string;
  initial?: Target;
  animate?: Target;
  whileInView?: Target;
  transition?: Transition;
};

export function AnimatedSection({
  children,
  className,
  initial,
  animate,
  whileInView,
  transition,
}: AnimatedSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (initial) {
      controls.set(initial);
    }
  }, []);

  useEffect(() => {
    if (whileInView) {
      if (inView) {
        controls.start({ ...whileInView, transition });
      }
    } else if (animate) {
      controls.start({ ...animate, transition });
    }
  }, [inView]);

  return (
    <motion.div ref={ref} animate={controls} className={className}>
      {children}
    </motion.div>
  );
}
