import { lazy, Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { heroImage } from "@/data/content";
import { useLanguage } from "@/hooks/useLanguage";
import { ResponsiveImage } from "@/components/ResponsiveImage";
import { LazyMount } from "@/components/LazyMount";
import { buttonVariants } from "@/components/ui/Button";

const HomeSections = lazy(() => import("@/components/HomeSections"));

export default function HomePage() {
  const { t } = useTranslation();
  const language = useLanguage();

  return (
    <>
      {/* Hero choreography (media → wordmark → copy → CTA), the pointer layers and
          every reveal below are owned by the GSAP motion system: this markup only
          declares the contract, GSAP is the single writer of transform/opacity. */}
      <section
        data-hero=""
        data-mouse-parallax=""
        className="relative flex min-h-[720px] h-[100svh] max-h-[1080px] items-end overflow-hidden bg-bun-ink text-white"
      >
        <div
          data-hero-media=""
          data-mouse-depth="0.012"
          className="absolute inset-0 will-change-transform"
        >
          <ResponsiveImage
            src={heroImage}
            alt={language === "fa" ? "مردی در حال گاز زدن یک برگر در آشپزخانه" : "A man taking a confident bite of a burger in a kitchen"}
            eager
            sizes="100vw"
            className="h-full w-full"
            imageClassName="object-[62%_center] sm:object-center"
          />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,8,8,.2)_0%,rgba(10,8,8,.12)_30%,rgba(10,8,8,.92)_100%)] sm:bg-[linear-gradient(90deg,rgba(10,8,8,.82)_0%,rgba(10,8,8,.42)_52%,rgba(10,8,8,.08)_100%)] rtl:sm:bg-[linear-gradient(270deg,rgba(10,8,8,.82)_0%,rgba(10,8,8,.42)_52%,rgba(10,8,8,.08)_100%)]" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8 lg:pb-20">
          <div className="max-w-3xl">
            <p
              data-hero-wordmark=""
              data-mouse-depth="0.022"
              className="font-display text-[clamp(4.5rem,14vw,10rem)] font-black leading-[0.72] tracking-[-0.1em] text-white"
            >
              6Burger<span className="text-bun-orange">Elin</span>
            </p>
            <div data-hero-copy="">
              <h1 className="mt-8 max-w-2xl font-display text-[clamp(2.2rem,6vw,5rem)] font-black leading-[0.94] tracking-[-0.055em]">
                {t("home.heroTitle")}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/78 sm:text-lg">{t("home.heroDescription")}</p>
            </div>
            <div data-hero-cta="" className="mt-7">
              <Link
                to="/menu"
                data-magnetic="0.16"
                data-cursor-label={t("common.viewMenu")}
                className={buttonVariants({ size: "lg" })}
              >
                {t("common.viewMenu")}
                <ArrowRight className={`size-5 ${language === "fa" ? "rotate-180" : ""}`} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <LazyMount minHeight={1800}>
        <Suspense fallback={<div className="min-h-[600px] bg-bun-paper" />}>
          <HomeSections />
        </Suspense>
      </LazyMount>
    </>
  );
}