import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, BadgeCheck } from "lucide-react";
import { type KeyboardEvent, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { MotionSection } from "@/components/MotionSection";
import { MotionText } from "@/components/MotionText";
import { ReviewStars } from "@/components/ReviewStars";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/hooks/useLanguage";
import { useTableTalk } from "@/hooks/useTableTalk";
import { prefersReducedMotion } from "@/motion/smoothScroll";
import { cn } from "@/utils/cn";
import { formatReviewDate, formatReviewNumber } from "@/utils/reviews";
import { stepTableTalkIndex } from "@/utils/tableTalk";

/**
 * بخش «Table Talk» صفحهٔ اصلی — سبک Editorial Minimal.
 *
 * قواعد طراحی:
 *   - نقل‌قول با تایپوگرافی درشت و شکست خطوط متعادل (`text-balance`) ستون اصلی
 *     است؛ بقیهٔ اطلاعات (نام، امتیاز، خرید تأییدشده، تاریخ) در ردیف پایین آن
 *     می‌نشینند تا سلسله‌مراتب خواندن روشن بماند.
 *   - اسلایدر هیچ حرکت خودکاری ندارد؛ فقط کنترل قبلی/بعدی و کلیدهای جهت.
 *   - انیمیشن جابه‌جایی کوتاه و ظریف است و با `prefers-reduced-motion` کامل
 *     خاموش می‌شود.
 *   - بدون دادهٔ ساختگی: اگر فهرست خالی باشد کل بخش پنهان می‌ماند و اگر درخواست
 *     شکست بخورد یک پیام کوتاه با دکمهٔ تلاش دوباره نشان داده می‌شود.
 */
export function TableTalk() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { items, status, retry } = useTableTalk();
  const [index, setIndex] = useState(0);
  const reduced = prefersReducedMotion();

  const total = items.length;
  const safeIndex = total ? index % total : 0;
  const active = items[safeIndex] ?? null;

  const step = useCallback(
    (direction: number) => {
      setIndex((current) => stepTableTalkIndex(current, total, direction));
    },
    [total],
  );

  /** کلیدهای جهت با جهت صفحه هم‌راستا می‌شوند (RTL برعکس LTR). */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (total < 2) return;
    const forward = language === "fa" ? "ArrowLeft" : "ArrowRight";
    const backward = language === "fa" ? "ArrowRight" : "ArrowLeft";

    if (event.key === forward) {
      event.preventDefault();
      step(1);
    } else if (event.key === backward) {
      event.preventDefault();
      step(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setIndex(total - 1);
    }
  };

  // فهرست خالی یعنی مدیر هنوز روایتی برای صفحهٔ اصلی انتخاب نکرده است؛ بلوک
  // خالی نمایش داده نمی‌شود.
  if (status === "ready" && total === 0) return null;

  const date = active ? formatReviewDate(active.createdAt, language) : "";
  const name = active?.name[language].trim() || t("reviews.anonymous");

  return (
    <MotionSection className="bg-bun-paper py-20 sm:py-28" aria-label={t("home.testimonialsTitle")}>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-16 lg:px-8">
        <div className="lg:pt-2" data-reveal-group="">
          <p className="section-kicker" data-reveal-item="">
            {t("home.testimonialsKicker")}
          </p>
          <MotionText
            text={t("home.testimonialsTitle")}
            className="section-title mt-3 text-[clamp(2rem,3.4vw,3rem)]"
          />
          <p className="section-copy mt-4 max-w-sm text-sm" data-reveal-item="">
            {t("home.testimonialsSubtitle")}
          </p>
        </div>

        <div className="relative" data-reveal-group="">
          <div
            role="group"
            aria-roledescription={t("home.testimonialsCarousel")}
            aria-label={t("home.testimonialsTitle")}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className="relative overflow-hidden rounded-[2rem] border border-bun-line bg-bun-surface/50 p-6 outline-none transition-shadow duration-200 focus-visible:ring-2 focus-visible:ring-bun-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bun-paper sm:p-10 lg:p-12"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -top-4 end-6 select-none font-display text-[7rem] leading-none text-bun-orange/20"
            >
              ”
            </span>

            <div aria-live="polite" aria-atomic="true">
              {status === "loading" ? (
                <div className="space-y-4" aria-busy="true" aria-label={t("common.loading")}>
                  <span className="block h-6 w-4/5 animate-pulse rounded-full bg-bun-text/8" />
                  <span className="block h-6 w-full animate-pulse rounded-full bg-bun-text/8" />
                  <span className="block h-6 w-3/5 animate-pulse rounded-full bg-bun-text/8" />
                  <span className="block h-4 w-32 animate-pulse rounded-full bg-bun-text/8" />
                </div>
              ) : null}

              {status === "error" ? (
                <div role="status">
                  <p className="text-sm leading-7 text-bun-muted">{t("home.testimonialsError")}</p>
                  <Button variant="secondary" size="sm" className="mt-4" onClick={retry}>
                    {t("home.testimonialsRetry")}
                  </Button>
                </div>
              ) : null}

              {active ? (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.blockquote
                    key={active.id}
                    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
                    transition={{ duration: reduced ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="relative"
                  >
                    <p className="text-balance font-display text-[1.75rem] font-black leading-[1.35] tracking-[-0.02em] text-bun-text sm:text-4xl sm:leading-[1.25]">
                      {active.quote[language]}
                    </p>

                    <footer className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-bun-line pt-5 text-sm">
                      <cite className="not-italic font-black text-bun-text">{name}</cite>

                      {active.rating ? (
                        <ReviewStars
                          rating={active.rating}
                          size="sm"
                          label={t("reviews.starsAria", {
                            rating: formatReviewNumber(active.rating, language),
                          })}
                        />
                      ) : null}

                      {active.orderVerified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-bun-accent/10 px-2 py-0.5 text-[11px] font-bold text-bun-accent">
                          <BadgeCheck className="size-3.5" aria-hidden="true" />
                          {t("reviews.verified")}
                        </span>
                      ) : null}

                      {active.productName ? (
                        <span className="text-xs text-bun-muted">
                          {t("home.testimonialsAbout", { name: active.productName })}
                        </span>
                      ) : null}

                      {date ? (
                        <time dateTime={active.createdAt} className="ms-auto text-xs text-bun-muted">
                          {date}
                        </time>
                      ) : null}
                    </footer>
                  </motion.blockquote>
                </AnimatePresence>
              ) : null}
            </div>

            {total > 0 ? (
              <div className="mt-8 flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  {items.map((item, position) => (
                    <span
                      key={item.id}
                      className={cn(
                        "h-1 rounded-full transition-all duration-300",
                        position === safeIndex ? "w-8 bg-bun-orange" : "w-3 bg-bun-line",
                      )}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <p className="me-1 font-display text-xs tabular-nums text-bun-muted">
                    {formatReviewNumber(safeIndex + 1, language)} / {formatReviewNumber(total, language)}
                  </p>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => step(-1)}
                    disabled={total < 2}
                    aria-label={t("home.previousReview")}
                  >
                    <ArrowLeft
                      className={cn("size-4", language === "fa" && "rotate-180")}
                      aria-hidden="true"
                    />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => step(1)}
                    disabled={total < 2}
                    aria-label={t("home.nextReview")}
                  >
                    <ArrowRight
                      className={cn("size-4", language === "fa" && "rotate-180")}
                      aria-hidden="true"
                    />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </MotionSection>
  );
}

