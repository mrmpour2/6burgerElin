import { ArrowRight, Clock3, MapPin, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { FeaturedRail } from "@/components/FeaturedRail";
import { MotionSection } from "@/components/MotionSection";
import { MotionText } from "@/components/MotionText";
import { ResponsiveImage } from "@/components/ResponsiveImage";
import { TableTalk } from "@/components/TableTalk";
import { buttonVariants } from "@/components/ui/Button";
import { aboutImage, latestBlogPosts, locationImage, storeLocation } from "@/data/content";
import { useLanguage } from "@/hooks/useLanguage";

export default function HomeSections() {
  const { t } = useTranslation();
  const language = useLanguage();

  return (
    <>
      {/* «پرطرفدارها»: گالری سرمقاله‌ای با ریل افقی. ریل از `lg` به بالا در
          `initHorizontalGalleries` پین می‌شود و پایین‌تر از آن اسکرول لمسی
          بومی دارد؛ به همین دلیل بخش خودش هیچ reveal ندارد. */}
      <FeaturedRail />

      <MotionSection className="overflow-hidden bg-bun-surface">
        <div className="mx-auto grid max-w-[1600px] lg:grid-cols-2">
          <ResponsiveImage
            src={aboutImage}
            alt={language === "fa" ? "آشپزخانه گرم و شلوغ شیش برگر الین" : "The warm, busy شیش برگر الین kitchen"}
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="min-h-[380px] lg:min-h-[620px]"
            imageClassName="h-full"
            reveal
            parallax={0.12}
          />
          <div className="flex items-center px-4 py-16 sm:px-10 lg:px-16 lg:py-24 xl:px-24">
            <div className="max-w-xl" data-reveal-group="">
              <p className="section-kicker" data-reveal-item="">{t("home.aboutKicker")}</p>
              <MotionText text={t("home.aboutTitle")} className="section-title mt-3" />
              <p className="section-copy mt-6" data-reveal-item="">{t("home.aboutText")}</p>
              <div className="mt-8" data-reveal-item="">
                <Link
                  to="/blog/inside-the-kitchen"
                  data-magnetic="0.16"
                  data-cursor-label={t("common.learnMore")}
                  className={buttonVariants({ variant: "secondary" })}
                >
                  {t("common.learnMore")}
                  <ArrowRight className={`size-4 ${language === "fa" ? "rotate-180" : ""}`} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </MotionSection>

      {/* «Table Talk»: روایت‌های واقعی مشتریان از دیتابیس پنل (`/api/public/testimonials`).
          اگر مدیر هیچ روایتی را برای صفحهٔ اصلی انتخاب نکرده باشد، کل بخش پنهان می‌ماند. */}
      <TableTalk />

      <MotionSection className="bg-bun-paper pb-20 sm:pb-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div
            className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-bun-burgundy via-bun-red to-bun-orange px-6 py-12 text-white shadow-2xl shadow-bun-red/15 sm:px-12 sm:py-16 lg:px-16"
            data-reveal="blur-in"
          >
            <div className="absolute -end-20 -top-36 size-72 rounded-full bg-bun-gold/20 blur-3xl" />
            <div className="relative max-w-2xl" data-reveal-group="">
              <p className="font-display text-4xl font-black tracking-[-0.05em] sm:text-6xl" data-reveal-item="">شیش برگر الین CLUB</p>
              <MotionText text={t("home.loyaltyTitle")} className="mt-6 font-display text-3xl font-black tracking-tight sm:text-5xl" />
              <p className="mt-4 max-w-xl text-base leading-7 text-white/80" data-reveal-item="">{t("home.loyaltyText")}</p>
              <div className="mt-7" data-reveal-item="">
                <Link
                  to="/loyalty"
                  data-magnetic="0.16"
                  data-cursor-label={t("common.joinNow")}
                  className={buttonVariants({ variant: "secondary", size: "lg", className: "border-white/20 bg-white text-bun-ink hover:text-bun-red" })}
                >
                  {t("common.joinNow")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </MotionSection>

      <MotionSection className="bg-bun-surface py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="section-kicker" data-reveal="">{t("home.blogKicker")}</p>
          <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <MotionText text={t("home.blogTitle")} className="section-title max-w-2xl" />
            <Link
              to="/blog"
              data-magnetic="0.16"
              data-cursor-label={t("blog.allStories")}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {t("blog.allStories")}
            </Link>
          </div>
          <div className="mt-12 grid gap-10 lg:grid-cols-3" data-reveal-group="">
            {latestBlogPosts.map((post) => (
              <article key={post.id} className="group" data-reveal-item="">
                <Link to={`/blog/${post.id}`} className="block rounded-[1.5rem] outline-none focus-visible:ring-2 focus-visible:ring-bun-gold focus-visible:ring-offset-4 focus-visible:ring-offset-bun-surface">
                  <ResponsiveImage
                    src={post.image}
                    alt={post.imageAlt[language]}
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    className="aspect-[16/11] rounded-[1.5rem]"
                    imageClassName="transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                </Link>
                <div className="pt-5">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-bun-muted">{post.date[language]} · {post.readTime} {t("common.minutes")}</p>
                  <h3 className="mt-3 font-display text-2xl font-black leading-tight text-bun-text">{post.title[language]}</h3>
                  <p className="mt-3 text-sm leading-6 text-bun-muted">{post.excerpt[language]}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </MotionSection>

      <MotionSection className="bg-bun-paper py-20 sm:py-28">
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-4 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
          <div className="max-w-xl" data-reveal-group="">
            <div className="mb-5 inline-flex size-12 items-center justify-center rounded-2xl bg-bun-orange/12 text-bun-accent" data-reveal-item="">
              <QrCode className="size-6" aria-hidden="true" />
            </div>
            <MotionText text={t("home.qrTitle")} className="section-title" />
            <p className="section-copy mt-4" data-reveal-item="">{t("home.qrText")}</p>
          </div>
          <div
            className="w-fit rounded-[1.75rem] bg-white p-5 shadow-xl shadow-black/8"
            aria-label={t("home.scanLabel")}
            data-reveal="scale"
          >
            <QRCodeSVG
              value={`${window.location.origin}/menu`}
              size={190}
              bgColor="#ffffff"
              fgColor="#1b1716"
              level="M"
              marginSize={1}
              title={t("home.scanLabel")}
            />
          </div>
        </div>
      </MotionSection>

      <MotionSection className="overflow-hidden bg-bun-ink text-white">
        <div className="mx-auto grid max-w-[1600px] lg:grid-cols-2">
          <div className="flex items-center px-4 py-16 sm:px-10 lg:px-16 lg:py-24 xl:px-24">
            <div className="max-w-xl" data-reveal-group="">
              <p className="section-kicker !text-bun-orange" data-reveal-item="">{t("home.locationKicker")}</p>
              <MotionText text={t("home.locationTitle")} className="section-title mt-3 text-white" />
              <div className="mt-8 space-y-5 text-white/75" data-reveal-item="">
                <p className="flex items-start gap-3 leading-7"><MapPin className="mt-1 size-5 shrink-0 text-bun-orange" aria-hidden="true" /> {t("home.address")}</p>
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-1 size-5 shrink-0 text-bun-orange" aria-hidden="true" />
                  <div><p className="font-bold text-white">{t("home.hoursTitle")}</p><p className="mt-1">{t("home.hours")}</p></div>
                </div>
              </div>
              <div className="mt-8" data-reveal-item="">
                <a
                  href={storeLocation.directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  data-magnetic="0.16"
                  data-cursor-label={t("home.directions")}
                  className={buttonVariants()}
                >
                  {t("home.directions")}
                </a>
              </div>
            </div>
          </div>
          <ResponsiveImage
            src={locationImage}
            alt={language === "fa" ? "فضای گرم و دنج رستوران" : "Warm and inviting restaurant interior"}
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="min-h-[400px] lg:min-h-[620px]"
            imageClassName="h-full"
            reveal
            parallax={0.12}
          />
        </div>
      </MotionSection>
    </>
  );
}