import { useEffect } from "react";
import { startMotionSystem } from "@/motion/motionSystem";

/**
 * Boots the data-attribute driven GSAP motion system once per page load.
 * Every tween/ScrollTrigger/listener lives inside a `gsap.context()`, so the
 * effect cleanup restores the DOM to its pre-animation state.
 */
export function useMotionSystem(): void {
  useEffect(() => {
    const controller = startMotionSystem();
    return () => controller.destroy();
  }, []);
}
