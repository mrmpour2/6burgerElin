import { MotionText } from "@/components/MotionText";

interface PageIntroProps {
  kicker: string;
  title: string;
  description?: string;
}

export function PageIntro({ kicker, title, description }: PageIntroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-bun-ink via-bun-burgundy to-bun-red px-4 pb-16 pt-36 text-white sm:px-6 sm:pb-20 sm:pt-40 lg:px-8">
      <div className="absolute -end-28 -top-28 size-80 rounded-full bg-bun-orange/20 blur-3xl" />
      {/* Label first, heading second, supporting copy third. */}
      <div className="relative mx-auto max-w-7xl" data-reveal-group="">
        <p className="section-kicker !text-bun-orange" data-reveal-item="">
          {kicker}
        </p>
        <MotionText
          as="h1"
          text={title}
          className="mt-3 max-w-4xl font-display text-[clamp(2.8rem,8vw,6.5rem)] font-black leading-[0.9] tracking-[-0.06em]"
        />
        {description ? (
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/72 sm:text-lg" data-reveal-item="">
            {description}
          </p>
        ) : null}
      </div>
    </section>
  );
}