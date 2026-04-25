import { motion, useReducedMotion, type HTMLMotionProps, type Variants } from "motion/react";
import type * as React from "react";

import { cn } from "@/lib/utils";

const pageVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      duration: 0.34,
      bounce: 0,
    },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: {
      duration: 0.16,
      ease: [0.4, 0, 1, 1],
    },
  },
};

const reducedPageVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.01 } },
  exit: { opacity: 0, transition: { duration: 0.01 } },
};

type AnimatedPageProps = HTMLMotionProps<"div"> & {
  children: React.ReactNode;
  stagger?: boolean;
};

function AnimatedPage({ className, children, stagger = true, ...props }: AnimatedPageProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn("min-h-full", stagger && "motion-page-stagger", className)}
      variants={reduceMotion ? reducedPageVariants : pageVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      {...props}
    >
      {children}
    </motion.div>
  );
}

export { AnimatedPage, motion };
