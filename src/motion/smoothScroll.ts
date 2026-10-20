import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger);

let activeLenis: Lenis | null = null;

/** True when the visitor asked their OS for reduced motion. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Boots Lenis once per page load and drives it from the GSAP ticker, so
 * ScrollTrigger always reads the same smooth scroll position Lenis renders.
 * Returns a cleanup function; it is safe to call more than once.
 */
export function startSmoothScroll(): () => void {
  if (activeLenis || prefersReducedMotion()) return () => undefined;

  const instance = new Lenis({
    lerp: 0.085,
    wheelMultiplier: 0.92,
    touchMultiplier: 1.6,
    anchors: true,
    autoRaf: false,
  });
  activeLenis = instance;

  const syncScrollTrigger = () => ScrollTrigger.update();
  const tick = (time: number) => instance.raf(time * 1000);

  instance.on("scroll", syncScrollTrigger);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  ScrollTrigger.refresh();

  return () => {
    gsap.ticker.remove(tick);
    gsap.ticker.lagSmoothing(500, 33);
    instance.destroy();
    activeLenis = null;
  };
}

/** Jumps to the top, through Lenis when it owns the scroll. */
export function scrollToTop(): void {
  if (activeLenis) {
    activeLenis.scrollTo(0, { immediate: true });
    return;
  }
  window.scrollTo({ top: 0, behavior: "instant" });
}

/** Re-measures every ScrollTrigger after a layout-affecting change (language, dir, fonts). */
export function refreshMotion(): void {
  ScrollTrigger.refresh();
}
