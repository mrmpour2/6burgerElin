import { ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/hooks/useLanguage";
import type { ReviewSort, StarRating } from "@/types";
import { cn } from "@/utils/cn";
import { formatReviewNumber, toStarRating } from "@/utils/reviews";

interface ReviewFiltersProps {
  sort: ReviewSort;
  rating: StarRating | null;
  withImagesOnly: boolean;
  /** تعداد نظرهای منطبق با فیلتر فعلی. */
  total: number;
  /** نتیجهٔ فیلتر تازه در راه است؛ فهرست قبلی روی صفحه مانده و فقط کم‌رنگ می‌شود. */
  isRefreshing: boolean;
  onSortChange: (sort: ReviewSort) => void;
  onRatingChange: (rating: StarRating | null) => void;
  onWithImagesOnlyChange: (value: boolean) => void;
  onReset: () => void;
}

/**
 * گزینه‌های مرتب‌سازی.
 *
 * `as const` باعث می‌شود `value` و `labelKey` لیترال بمانند: مقدار انتخابی بدون
 * `as ReviewSort` به تابع تغییر می‌رسد و کلید i18n هم تایپ‌شده معتبر می‌ماند.
 */
const SORT_OPTIONS = [
  { value: "newest", labelKey: "reviews.sort.newest" },
  { value: "oldest", labelKey: "reviews.sort.oldest" },
  { value: "highest", labelKey: "reviews.sort.highest" },
  { value: "lowest", labelKey: "reviews.sort.lowest" },
] as const;

/** ردیف‌های فیلتر امتیاز؛ از ۵ ستاره به ۱ (رایج‌ترین چیدمان). */
const RATING_OPTIONS = [5, 4, 3, 2, 1] as const;

/** مقدار گزینهٔ «همهٔ امتیازها»؛ عدد نیست تا با ستاره‌های واقعی قاطی نشود. */
const ALL_RATINGS = "all";

const labelClass = "mb-1.5 block text-xs font-bold text-bun-muted";

const selectClass =
  "h-11 w-full cursor-pointer appearance-none rounded-2xl border border-bun-line bg-bun-paper px-4 pe-10 text-sm font-bold text-bun-text outline-none transition focus-visible:border-bun-orange focus-visible:ring-2 focus-visible:ring-bun-orange/25";

const chevronClass =
  "pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-bun-muted";

/**
 * فیلتر و مرتب‌سازی فهرست نظرها.
 *
 * کنترل‌های بومی (`select` و `checkbox`) استفاده شده‌اند: روی موبایل همان تجربهٔ
 * سیستم‌عامل را می‌دهند، با کیبورد و صفحه‌خوان کامل کار می‌کنند و برای منوی بازشو
 * به جاوااسکریپت اضافه نیاز ندارند. تعداد نتیجه هم با `aria-live` اعلام می‌شود تا
 * تغییر فیلتر برای کاربر صفحه‌خوان بی‌صدا نماند.
 */
export function ReviewFilters({
  sort,
  rating,
  withImagesOnly,
  total,
  isRefreshing,
  onSortChange,
  onRatingChange,
  onWithImagesOnlyChange,
  onReset,
}: ReviewFiltersProps) {
  const { t } = useTranslation();
  const language = useLanguage();
  const sortId = useId();
  const ratingId = useId();
  const imagesId = useId();

  const isDirty = sort !== "newest" || rating !== null || withImagesOnly;

  return (
    <div className="rounded-3xl border border-bun-line bg-bun-surface/50 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-sm font-black text-bun-text">
          <SlidersHorizontal className="size-4 text-bun-orange" aria-hidden="true" />
          {t("reviews.filter.label")}
        </p>
        <p
          aria-live="polite"
          className={cn(
            "text-xs font-bold text-bun-muted transition-opacity duration-200",
            isRefreshing && "opacity-50",
          )}
        >
          {t("reviews.listCount", { total: formatReviewNumber(total, language) })}
        </p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={sortId} className={labelClass}>
            {t("reviews.sort.label")}
          </label>
          <div className="relative">
            <select
              id={sortId}
              value={sort}
              onChange={(event) => {
                const next = SORT_OPTIONS.find((option) => option.value === event.target.value);
                if (next) onSortChange(next.value);
              }}
              className={selectClass}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" className={chevronClass} />
          </div>
        </div>

        <div>
          <label htmlFor={ratingId} className={labelClass}>
            {t("reviews.filter.rating")}
          </label>
          <div className="relative">
            <select
              id={ratingId}
              value={rating === null ? ALL_RATINGS : String(rating)}
              onChange={(event) => {
                if (event.target.value === ALL_RATINGS) {
                  onRatingChange(null);
                  return;
                }
                // مقدار `select` رشته است؛ `toStarRating` اعتبارسنجی می‌کند تا مقدار
                // غیرمنتظره (مثلاً از افزونهٔ مرورگر) بی‌اثر بماند.
                const next = toStarRating(Number(event.target.value));
                if (next !== null) onRatingChange(next);
              }}
              className={selectClass}
            >
              <option value={ALL_RATINGS}>{t("reviews.filter.allRatings")}</option>
              {RATING_OPTIONS.map((star) => (
                <option key={star} value={String(star)}>
                  {t("reviews.filter.ratingOption", { star: formatReviewNumber(star, language) })}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" className={chevronClass} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-3 rounded-2xl border border-bun-line bg-bun-paper px-4 py-3 transition hover:border-bun-orange/60">
          <input
            id={imagesId}
            type="checkbox"
            checked={withImagesOnly}
            onChange={(event) => onWithImagesOnlyChange(event.target.checked)}
            className="size-4 shrink-0 cursor-pointer accent-bun-orange"
          />
          <span className="text-sm font-bold text-bun-text">{t("reviews.filter.withImages")}</span>
        </label>

        {isDirty ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-bun-accent outline-none transition hover:bg-bun-text/5 focus-visible:ring-2 focus-visible:ring-bun-gold"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {t("reviews.filter.reset")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
