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

  const initialRef = useRef(initial);
  const animateRef = useRef(animate);
  const whileInViewRef = useRef(whileInView);
  const transitionRef = useRef(transition);

  useEffect(() => {
    if (initialRef.current) {
      controls.set(initialRef.current);
    }
  }, [controls]);

  useEffect(() => {
    if (whileInViewRef.current) {
      if (inView) {
        controls.start({ ...whileInViewRef.current, transition: transitionRef.current });
      }
    } else if (animateRef.current) {
      controls.start({ ...animateRef.current, transition: transitionRef.current });
    }
  }, [inView, controls]);

  return (
    <motion.div ref={ref} animate={controls} className={className}>
      {children}
    </motion.div>
  );
}
