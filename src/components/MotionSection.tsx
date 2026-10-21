import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { RevealPreset } from "@/types";
import { cn } from "@/utils/cn";

interface MotionSectionProps extends Omit<ComponentPropsWithoutRef<"section">, "children"> {
  children: ReactNode;
  /** Scroll-reveal preset owned by the GSAP motion system. */
  preset?: RevealPreset;
  /** Seconds before the reveal starts. */
  delay?: number;
}

/**
 * A `<section>` that declares its entrance through the `data-reveal` contract
 * instead of animating itself, so `src/motion/motionSystem.ts` stays the only
 * writer of transform/opacity and no two engines fight over the element.
 */
export function MotionSection({
  children,
  className,
  preset = "fade-up",
  delay,
  ...props
}: MotionSectionProps) {
  return (
    <section
      className={cn(className)}
      data-reveal={preset}
      {...(delay && delay > 0 ? { "data-reveal-delay": delay } : null)}
      {...props}
    >
      {children}
    </section>
  );
}
