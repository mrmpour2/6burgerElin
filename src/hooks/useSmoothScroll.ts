import { useEffect } from "react";
import { startSmoothScroll } from "@/motion/smoothScroll";

/**
 * Mounts the Lenis smooth-scroll loop for the lifetime of the app.
 * The effect returns Lenis' own cleanup, so React owns the teardown.
 */
export function useSmoothScroll(): void {
  useEffect(() => startSmoothScroll(), []);
}
