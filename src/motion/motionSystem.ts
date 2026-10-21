import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { RevealPreset } from "@/types";
import { prefersReducedMotion } from "@/motion/smoothScroll";

gsap.registerPlugin(ScrollTrigger);

gsap.defaults({ ease: "power3.out", duration: 0.85 });
ScrollTrigger.config({ ignoreMobileResize: true });

/* ---------------------------------------------------------------------------
 * Motion system
 *
 * Data-attribute driven so React stays declarative: markup declares intent and
 * this module owns every tween, ScrollTrigger and DOM listener.
 *
 *   data-hero                section-scoped hero timeline
 *   data-motion-text         word/line masked reveal (children are .motion-word)
 *   data-reveal="preset"     single element scroll reveal
 *   data-reveal-group        staggered container of [data-reveal-item]
 *   data-image-reveal        clip-path + scale image reveal
 *   data-parallax-image      scrubbed parallax inside [data-parallax-section]
 *   data-horizontal-gallery  pinned horizontal rail (lg and up)
 *   data-mouse-parallax      pointer-reactive section holding [data-mouse-depth]
 *   data-magnetic            magnetic hover (buttons)
 *   data-progress-bar        one-shot scaleX meter
 *   data-cursor              custom cursor with contextual [data-cursor-label]
 *
 * `gsap.context()` records everything created in a pass so `destroy()` restores
 * the DOM to its pre-animation state.
--------------------------------------------------------------------------- */

const CLAIM_ATTRIBUTE = {
  motion: "data-motion-ready",
  parallax: "data-parallax-ready",
  mouse: "data-mouse-ready",
  magnetic: "data-magnetic-ready",
  cursor: "data-cursor-ready",
  progress: "data-progress-ready",
  gallery: "data-gallery-ready",
} as const;

type ClaimKey = keyof typeof CLAIM_ATTRIBUTE;

const CLAIM_KEYS: readonly ClaimKey[] = [
  "motion",
  "parallax",
  "mouse",
  "magnetic",
  "cursor",
  "progress",
  "gallery",
];

/** Targets watched for late (lazy) mounts so new sections get animated too. */
const PENDING_SELECTOR = [
  "[data-hero]",
  "[data-motion-text]",
  "[data-reveal]",
  "[data-reveal-group]",
  "[data-image-reveal]",
  "[data-parallax-image]",
  "[data-horizontal-gallery]",
  "[data-progress-bar]",
].join(",");

const PENDING_CLAIMS: readonly ClaimKey[] = ["motion", "parallax", "progress", "gallery"];

/** The pinned rail is only initialized on this query; below it the rail is a plain grid. */
const GALLERY_MEDIA_QUERY = "(min-width: 1024px)";

interface RevealPresetVars {
  readonly from: gsap.TweenVars;
  readonly to: gsap.TweenVars;
}

const REVEAL_PRESETS = {
  "fade-up": {
    from: { y: 34, autoAlpha: 0, filter: "blur(8px)" },
    to: { y: 0, autoAlpha: 1, filter: "blur(0px)", duration: 0.95 },
  },
  "blur-in": {
    from: { autoAlpha: 0, scale: 0.985, filter: "blur(14px)" },
    to: { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 1.05 },
  },
  scale: {
    from: { autoAlpha: 0, scale: 0.94 },
    to: { autoAlpha: 1, scale: 1, duration: 0.9 },
  },
  "slide-left": {
    from: { x: 40, autoAlpha: 0 },
    to: { x: 0, autoAlpha: 1, duration: 0.95 },
  },
  "slide-right": {
    from: { x: -40, autoAlpha: 0 },
    to: { x: 0, autoAlpha: 1, duration: 0.95 },
  },
} satisfies Record<RevealPreset, RevealPresetVars>;

const REVEAL_PRESET_NAMES = Object.keys(REVEAL_PRESETS) as RevealPreset[];

const revealPresetSet: ReadonlySet<string> = new Set(REVEAL_PRESET_NAMES);

function isRevealPreset(value: string | undefined): value is RevealPreset {
  return value !== undefined && revealPresetSet.has(value);
}

/** Direction-aware preset so slide reveals travel inwards in RTL too. */
function resolvePreset(name: RevealPreset, direction: 1 | -1): RevealPresetVars {
  const preset = REVEAL_PRESETS[name];
  if (direction === 1 || (name !== "slide-left" && name !== "slide-right")) return preset;
  const flip = (vars: gsap.TweenVars): gsap.TweenVars =>
    typeof vars.x === "number" ? { ...vars, x: -vars.x } : vars;
  return { from: flip(preset.from), to: flip(preset.to) };
}

function queryAll<T extends Element>(root: ParentNode, selector: string): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

function isClaimed(element: Element, key: ClaimKey): boolean {
  return element.getAttribute(CLAIM_ATTRIBUTE[key]) === "true";
}

function claim(element: Element, key: ClaimKey): void {
  element.setAttribute(CLAIM_ATTRIBUTE[key], "true");
}

/** Selects unclaimed targets and marks them, so repeated passes stay idempotent. */
function unclaimed(root: ParentNode, selector: string, key: ClaimKey): HTMLElement[] {
  return queryAll<HTMLElement>(root, selector).filter((element) => {
    if (isClaimed(element, key)) return false;
    claim(element, key);
    return true;
  });
}

function releaseAll(root: ParentNode): void {
  CLAIM_KEYS.forEach((key) => {
    queryAll(root, `[${CLAIM_ATTRIBUTE[key]}]`).forEach((element) => {
      element.removeAttribute(CLAIM_ATTRIBUTE[key]);
    });
  });
}

function releaseGalleryClaims(root: ParentNode): void {
  queryAll(root, `[${CLAIM_ATTRIBUTE.gallery}]`).forEach((element) => {
    element.removeAttribute(CLAIM_ATTRIBUTE.gallery);
  });
}

function revealDelay(element: HTMLElement): number {
  const value = Number(element.dataset.revealDelay);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function hasPendingTargets(root: ParentNode): boolean {
  // A dormant rail is not a pending target: below `lg` `initHorizontalGalleries`
  // never runs, so the section stays unclaimed on purpose. Treating it as pending
  // would re-run a whole pass (and a `ScrollTrigger.refresh()`) on every DOM
  // mutation — an endless loop that pins the main thread on phones and tablets.
  const galleryActive = window.matchMedia(GALLERY_MEDIA_QUERY).matches;
  return queryAll<HTMLElement>(root, PENDING_SELECTOR).some((element) => {
    if (!galleryActive && element.hasAttribute("data-horizontal-gallery")) return false;
    return PENDING_CLAIMS.every((key) => !isClaimed(element, key));
  });
}

/* ----------------------------------- passes -------------------------------- */

function initHeroScene(root: ParentNode): void {
  unclaimed(root, "[data-hero]", "motion").forEach((hero) => {
    const media = hero.querySelector<HTMLElement>("[data-hero-media]");
    const wordmark = hero.querySelector<HTMLElement>("[data-hero-wordmark]");
    const copy = hero.querySelector<HTMLElement>("[data-hero-copy]");
    const cta = hero.querySelector<HTMLElement>("[data-hero-cta]");
    const timeline = gsap.timeline({ defaults: { ease: "power4.out" }, delay: 0.08 });

    if (media) {
      timeline.fromTo(
        media,
        { autoAlpha: 0, scale: 1.06, filter: "blur(14px)" },
        { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 1.5 },
        0,
      );
    }
    if (wordmark) {
      timeline.fromTo(
        wordmark,
        { yPercent: 16, autoAlpha: 0 },
        { yPercent: 0, autoAlpha: 1, duration: 1.1 },
        0.18,
      );
    }
    if (copy) {
      timeline.fromTo(copy, { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9 }, 0.62);
    }
    if (cta) {
      timeline.fromTo(cta, { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.85 }, 0.78);
    }
  });
}

/**
 * Start offset for masked text. Must clear the mask's window (the line box plus
 * the 0.18em descender padding added in `index.css`), otherwise the incoming
 * word peeks through the mask before its tween starts.
 */
const MASKED_TEXT_OFFSET = 132;

function initTextReveals(root: ParentNode): void {
  unclaimed(root, "[data-motion-text]", "motion").forEach((element) => {
    const lines = queryAll<HTMLElement>(element, ".motion-line");
    const targets = lines.length ? lines : queryAll<HTMLElement>(element, ".motion-word");
    gsap.set(element, { autoAlpha: 1 });
    if (!targets.length) return;

    gsap.fromTo(
      targets,
      { yPercent: MASKED_TEXT_OFFSET, autoAlpha: 0, filter: "blur(8px)" },
      {
        yPercent: 0,
        autoAlpha: 1,
        filter: "blur(0px)",
        duration: lines.length ? 1.05 : 0.9,
        stagger: lines.length ? 0.1 : 0.045,
        delay: revealDelay(element),
        scrollTrigger: { trigger: element, start: "top 84%", once: true },
      },
    );
  });
}

function initScrollReveals(root: ParentNode, direction: 1 | -1): void {
  unclaimed(root, "[data-reveal-group]", "motion").forEach((group) => {
    const items = queryAll<HTMLElement>(group, "[data-reveal-item]").filter(
      (item) => !isClaimed(item, "motion"),
    );
    if (!items.length) return;
    items.forEach((item) => claim(item, "motion"));
    gsap.set(group, { autoAlpha: 1 });
    gsap.fromTo(
      items,
      { y: 38, autoAlpha: 0, filter: "blur(8px)" },
      {
        y: 0,
        autoAlpha: 1,
        filter: "blur(0px)",
        duration: 0.95,
        stagger: 0.08,
        scrollTrigger: { trigger: group, start: "top 82%", once: true },
      },
    );
  });

  unclaimed(root, "[data-reveal]:not([data-reveal-item])", "motion").forEach((element) => {
    const preset = resolvePreset(
      isRevealPreset(element.dataset.reveal) ? element.dataset.reveal : "fade-up",
      direction,
    );
    gsap.fromTo(element, preset.from, {
      ...preset.to,
      delay: revealDelay(element),
      scrollTrigger: { trigger: element, start: "top 85%", once: true },
    });
  });
}

function initImageReveals(root: ParentNode): void {
  unclaimed(root, "[data-image-reveal]", "motion").forEach((figure) => {
    const image = figure.querySelector("img");
    gsap.set(figure, { autoAlpha: 1 });
    const timeline = gsap.timeline({
      scrollTrigger: { trigger: figure, start: "top 82%", once: true },
    });
    timeline.fromTo(
      figure,
      { clipPath: "inset(0% 0% 100% 0%)" },
      { clipPath: "inset(0% 0% 0% 0%)", duration: 1.15, ease: "power4.out" },
      0,
    );
    if (image) {
      timeline.fromTo(
        image,
        { scale: 1.08, autoAlpha: 0.65 },
        { scale: 1, autoAlpha: 1, duration: 1.25 },
        0,
      );
    }
  });
}

function initParallax(root: ParentNode): void {
  unclaimed(root, "[data-parallax-image]", "parallax").forEach((image) => {
    const section = image.closest<HTMLElement>("[data-parallax-section]") ?? image;
    const speed = Number(image.dataset.parallaxSpeed) || 0.12;
    gsap.fromTo(
      image,
      { y: 0 },
      {
        y: () => -window.innerHeight * speed,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "bottom top",
          scrub: 1.2,
          invalidateOnRefresh: true,
        },
      },
    );
  });
}

function initProgressBars(root: ParentNode, direction: 1 | -1): void {
  unclaimed(root, "[data-progress-bar]", "progress").forEach((bar) => {
    const value = Math.min(1, Math.max(0, Number(bar.dataset.progress) || 0));
    gsap.set(bar, { transformOrigin: direction === 1 ? "left center" : "right center" });
    gsap.fromTo(
      bar,
      { scaleX: 0 },
      {
        scaleX: value,
        duration: 1.2,
        ease: "power4.out",
        scrollTrigger: { trigger: bar, start: "top 90%", once: true },
      },
    );
  });
}

/** Pinned horizontal rail: lg and up only, reverted automatically when the query flips. */
function initHorizontalGalleries(root: ParentNode, direction: 1 | -1): void {
  unclaimed(root, "[data-horizontal-gallery]", "gallery").forEach((section) => {
    const track = section.querySelector<HTMLElement>("[data-horizontal-track]");
    if (!track) return;

    const distance = () => {
      const trackRect = track.getBoundingClientRect();
      const sectionRect = section.getBoundingClientRect();
      const lead =
        direction === 1 ? trackRect.left - sectionRect.left : sectionRect.right - trackRect.right;
      return Math.max(0, Math.round(trackRect.width + lead - section.clientWidth));
    };

    if (distance() < 80) return;

    gsap.to(track, {
      x: () => direction * -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => `+=${distance() + window.innerHeight * 0.35}`,
        scrub: 1,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });
  });
}

function initMagnetic(root: ParentNode): () => void {
  const targets = unclaimed(root, "[data-magnetic]", "magnetic");
  const cleanups = targets.map((element) => {
    const strength = Number(element.dataset.magnetic) || 0.18;
    const xTo = gsap.quickTo(element, "x", { duration: 0.55, ease: "power3.out" });
    const yTo = gsap.quickTo(element, "y", { duration: 0.55, ease: "power3.out" });

    const onMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      xTo((event.clientX - (rect.left + rect.width / 2)) * strength);
      yTo((event.clientY - (rect.top + rect.height / 2)) * strength);
    };
    const onLeave = () => {
      xTo(0);
      yTo(0);
    };

    element.addEventListener("pointermove", onMove, { passive: true });
    element.addEventListener("pointerleave", onLeave, { passive: true });

    return () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
      gsap.set(element, { clearProps: "x,y" });
    };
  });

  return () => cleanups.forEach((cleanup) => cleanup());
}

function initMouseParallax(root: ParentNode): () => void {
  const cleanups = unclaimed(root, "[data-mouse-parallax]", "mouse").map((section) => {
    const layers = queryAll<HTMLElement>(section, "[data-mouse-depth]").map((element) => ({
      element,
      depth: Number(element.dataset.mouseDepth) || 0.02,
      xTo: gsap.quickTo(element, "x", { duration: 0.9, ease: "power3.out" }),
      yTo: gsap.quickTo(element, "y", { duration: 0.9, ease: "power3.out" }),
    }));

    if (!layers.length) return () => undefined;

    const onMove = (event: PointerEvent) => {
      const rect = section.getBoundingClientRect();
      const offsetX = event.clientX - (rect.left + rect.width / 2);
      const offsetY = event.clientY - (rect.top + rect.height / 2);
      layers.forEach((layer) => {
        layer.xTo(offsetX * layer.depth);
        layer.yTo(offsetY * layer.depth);
      });
    };

    section.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      section.removeEventListener("pointermove", onMove);
      layers.forEach((layer) => gsap.set(layer.element, { clearProps: "x,y" }));
    };
  });

  return () => cleanups.forEach((cleanup) => cleanup());
}

function initCursor(root: ParentNode): () => void {
  const cursor = root.querySelector<HTMLElement>("[data-cursor]");
  if (!cursor || isClaimed(cursor, "cursor")) return () => undefined;
  claim(cursor, "cursor");

  const label = cursor.querySelector<HTMLElement>("[data-cursor-label]");
  const xTo = gsap.quickTo(cursor, "x", { duration: 0.45, ease: "power3.out" });
  const yTo = gsap.quickTo(cursor, "y", { duration: 0.45, ease: "power3.out" });

  const onMove = (event: PointerEvent) => {
    xTo(event.clientX);
    yTo(event.clientY);
  };
  const onOver = (event: PointerEvent) => {
    const target =
      event.target instanceof Element ? event.target.closest<HTMLElement>("[data-cursor-label]") : null;
    const text = target?.dataset.cursorLabel ?? "";
    if (label) label.textContent = text;
    cursor.dataset.cursorState = text ? "active" : "idle";
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerover", onOver, { passive: true });
  gsap.set(cursor, { autoAlpha: 1 });

  return () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerover", onOver);
    gsap.set(cursor, { autoAlpha: 0, clearProps: "x,y" });
  };
}

/* --------------------------------- controller ------------------------------ */

export interface MotionController {
  /** Re-measures every trigger (fonts loaded, images decoded, language swapped). */
  refresh(): void;
  destroy(): void;
}

const NOOP_CONTROLLER: MotionController = {
  refresh: () => ScrollTrigger.refresh(),
  destroy: () => undefined,
};

/**
 * Boots the motion system for the current document and returns a controller.
 * The React hook calls `destroy()` on unmount, which reverts every tween and
 * removes every listener created here.
 */
export function startMotionSystem(root: ParentNode = document): MotionController {
  if (prefersReducedMotion()) return NOOP_CONTROLLER;

  const direction: 1 | -1 = document.documentElement.getAttribute("dir") === "rtl" ? -1 : 1;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const context = gsap.context(() => undefined);
  const listenerCleanups: Array<() => void> = [];
  let galleryMedia: gsap.MatchMedia | null = null;
  let observer: MutationObserver | null = null;
  let safetyTimer: number | null = null;
  let destroyed = false;

  const syncGalleries = () => {
    galleryMedia?.revert();
    galleryMedia = gsap.matchMedia();
    galleryMedia.add(GALLERY_MEDIA_QUERY, () => {
      initHorizontalGalleries(root, direction);
      return () => releaseGalleryClaims(root);
    });
  };

  const pass = () => {
    if (destroyed) return;
    try {
      context.add(() => {
        document.documentElement.classList.add("has-motion");
        initHeroScene(root);
        initTextReveals(root);
        initScrollReveals(root, direction);
        initImageReveals(root);
        initParallax(root);
        initProgressBars(root, direction);
        if (finePointer) {
          listenerCleanups.push(initMagnetic(root), initMouseParallax(root), initCursor(root));
        }
      });
      syncGalleries();
      ScrollTrigger.refresh();
    } catch (error) {
      console.error("[motion] init failed, falling back to static content", error);
      context.revert();
      document.documentElement.classList.remove("has-motion");
      releaseAll(root);
    }
  };

  const refresh = () => {
    if (!destroyed) ScrollTrigger.refresh();
  };

  pass();

  // Lazy sections mount after the first pass, so re-run when unclaimed targets appear.
  observer = new MutationObserver(() => {
    if (destroyed || !hasPendingTargets(root)) return;
    pass();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  safetyTimer = window.setTimeout(() => {
    if (!destroyed && hasPendingTargets(root)) pass();
  }, 1400);

  window.addEventListener("load", refresh);
  void document.fonts?.ready.then(refresh).catch(() => undefined);

  return {
    refresh,
    destroy() {
      destroyed = true;
      observer?.disconnect();
      if (safetyTimer !== null) window.clearTimeout(safetyTimer);
      window.removeEventListener("load", refresh);
      listenerCleanups.forEach((cleanup) => cleanup());
      galleryMedia?.revert();
      context.revert();
      document.documentElement.classList.remove("has-motion");
      releaseAll(root);
    },
  };
}




