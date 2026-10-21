import { useTranslation } from "react-i18next";
import { ReviewStars } from "@/components/ReviewStars";
import { useLanguage } from "@/hooks/useLanguage";
import type { ReviewSummary } from "@/types";
import { cn } from "@/utils/cn";
import { formatReviewNumber, starShare } from "@/utils/reviews";

interface RatingSummaryProps {
  summary: ReviewSummary;
  className?: string;
}

/** ترتیب نمایش ردیف‌ها: از ۵ ستاره به ۱ (رایج‌ترین چیدمان نمودار امتیاز). */
const STARS = [5, 4, 3, 2, 1] as const;

/**
 * خلاصهٔ امتیاز محصول: میانگین + تعداد + نمودار پراکندگی ستاره‌ها.
 *
 * تعداد و درصد هر ردیف به‌صورت متن هم نوشته می‌شود، پس میله‌ها فقط تزئینی‌اند و
 * اطلاعات تنها از راه رنگ منتقل نمی‌شود (الزام دسترس‌پذیری).
 */
export function RatingSummary({ summary, className }: RatingSummaryProps) {
  const { t } = useTranslation();
  const language = useLanguage();

  const total = summary.total;
  const average = formatReviewNumber(summary.average, language);

  return (
    <div
      className={cn(
        "rounded-3xl border border-bun-line bg-bun-surface/70 p-6 backdrop-blur-sm sm:p-7",
        className,
      )}
    >
      <div className="flex items-center gap-5">
        <div className="shrink-0 text-center">
          <p className="font-display text-5xl font-black leading-none text-bun-text">{average}</p>
          <ReviewStars
            rating={summary.average}
            size="sm"
            label={t("reviews.starsAria", { rating: average })}
            className="mt-2 justify-center"
          />
        </div>
        <div className="border-s border-bun-line ps-5">
          <p className="text-sm font-black text-bun-text">{t("reviews.summaryTitle")}</p>
          <p className="mt-1 text-sm leading-6 text-bun-muted">
            {total > 0
              ? t("reviews.basedOn", { total: formatReviewNumber(total, language) })
              : t("reviews.noRatings")}
          </p>
        </div>
      </div>

      <ul className="mt-6 space-y-3">
        {STARS.map((star) => {
          const count = summary.distribution[star];
          const share = starShare(count, total);

          return (
            <li key={star} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-xs font-bold text-bun-muted">
                {t("reviews.starRow", { star: formatReviewNumber(star, language) })}
              </span>
              <span
                aria-hidden="true"
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-bun-line/70"
              >
                <span
                  className="block h-full rounded-full bg-bun-gold transition-[width] duration-500 ease-out"
                  style={{ width: `${share}%` }}
                />
              </span>
              <span className="w-10 shrink-0 text-end text-xs font-bold text-bun-text">
                {formatReviewNumber(count, language)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
