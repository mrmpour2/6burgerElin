import { Fragment, createElement } from "react";
import { cn } from "@/utils/cn";

type MotionTextTag = "h1" | "h2" | "h3" | "p" | "span";

type MotionTextMode = "words" | "lines";

interface MotionTextProps {
  /** Revealed as a whole for assistive tech through `aria-label`. */
  text: string;
  as?: MotionTextTag;
  /** `words` splits on whitespace (wraps responsively), `lines` splits on `\n`. */
  mode?: MotionTextMode;
  className?: string;
  /** Seconds to wait before this reveal starts (`data-reveal-delay`). */
  delay?: number;
}

/**
 * Renders `text` as masked spans so `src/motion/motionSystem.ts` can stagger the
 * words (or lines) into view. The spans are `aria-hidden` and the untouched
 * string is exposed once via `aria-label`, mirroring the reference splitter, so
 * the heading still reads correctly to screen readers and with JavaScript off.
 */
export function MotionText({ text, as = "h2", mode = "words", className, delay }: MotionTextProps) {
  const isLines = mode === "lines";
  const tokens = isLines ? text.split(/\n+/) : text.split(/(\s+)/);

  const children = tokens.map((token, index) => {
    // Whitespace stays a plain text node so the browser can still wrap lines.
    if (!token.trim()) return token;
    const key = `${token}-${index}`;
    const mask = (
      <span
        key={key}
        className={isLines ? "motion-line-mask" : "motion-word-mask"}
        aria-hidden="true"
      >
        <span className={isLines ? "motion-line" : "motion-word"}>{token}</span>
      </span>
    );
    return isLines ? <Fragment key={key}>{mask} </Fragment> : mask;
  });

  return createElement(
    as,
    {
      className: cn(className),
      "data-motion-text": mode,
      ...(delay && delay > 0 ? { "data-reveal-delay": delay } : null),
      "aria-label": text,
    },
    children,
  );
}
