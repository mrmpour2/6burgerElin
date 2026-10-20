import { AlertCircle, Info, Loader2, MessageSquarePlus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MotionSection } from "@/components/MotionSection";
import { RatingSummary } from "@/components/RatingSummary";
import { ReviewCard } from "@/components/ReviewCard";
import { ReviewFilters } from "@/components/ReviewFilters";
import { ReviewForm } from "@/components/ReviewForm";
import { SkeletonCard } from "@/components/SkeletonCard";
import { Button } from "@/components/ui/Button";
import { useProductReviews } from "@/hooks/useProductReviews";
import type { ReviewSort, StarRating } from "@/types";
import { cn } from "@/utils/cn";

interface ReviewsSectionProps {
  /** شناسهٔ محصول در دیتابیس پنل (`MenuItem.productId`). */
  productId: string;
  /** آیتم ثابت کاتالوگ شناسهٔ دیتابیس ندارد؛ پس نظرش فقط دادهٔ آزمایشی است. */
  demoOnly?: boolean;
  className?: string;
}

/** تعداد کارت اسکلتون بار اول؛ برابر صفحهٔ اول تا چیدمان نپرد. */
const SKELETON_COUNT = 3;

const DEFAULT_SORT: ReviewSort = "newest";

/**
 * بخش کامل نظرات محصول: خلاصهٔ امتیاز، فیلتر/مرتب‌سازی، فهرست و فرم ثبت نظر.
 *
 * چیدمان دوستونه (ریل کنار + فهرست) در `lg` و تک‌ستونه در موبایل است و ترتیب DOM
 * همان ترتیب خواندن می‌ماند، پس صفحه‌خوان و تب‌کیبورد مسیر منطقی دارند.
 * وضعیت فیلترها اینجاست (نه داخل هوک) تا با تغییر آن‌ها هوک خودش صفحهٔ اول را
 * دوباره بگیرد و فهرست قبلی تا رسیدن پاسخ روی صفحه بماند.
 */
export function ReviewsSection({ productId, demoOnly = false, className }: ReviewsSectionProps) {
  const { t } = useTranslation();

  const [sort, setSort] = useState<ReviewSort>(DEFAULT_SORT);
  const [rating, setRating] = useState<StarRating | null>(null);
  const [withImagesOnly, setWithImagesOnly] = useState(false);

  const {
    reviews,
    summary,
    source,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    total,
    hasError,
    loadMore,
    retry,
    submitReview,
  } = useProductReviews({ productId, demoOnly, sort, rating, withImagesOnly });

  const resetFilters = () => {
    setSort(DEFAULT_SORT);
    setRating(null);
    setWithImagesOnly(false);
  };

  return (
    <MotionSection id="reviews" className={cn("bg-bun-paper py-16 sm:py-24", className)}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="max-w-2xl">
          <p className="section-kicker">{t("reviews.kicker")}</p>
          <h2 className="section-title">{t("reviews.title")}</h2>
          <p className="mt-3 leading-7 text-bun-muted">{t("reviews.subtitle")}</p>
        </header>

        {source === "demo" ? (
          <p className="mt-6 flex items-start gap-3 rounded-3xl border border-bun-gold/40 bg-bun-gold/10 p-4 text-sm leading-6 text-bun-text">
            <Info className="mt-0.5 size-4 shrink-0 text-bun-gold" aria-hidden="true" />
            {t("reviews.demoNotice")}
          </p>
        ) : null}

        <div className="mt-10 grid gap-8 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
          <div className="space-y-5 lg:sticky lg:top-28">
            {isLoading ? (
              <div className="h-72 animate-pulse rounded-3xl border border-bun-line bg-bun-line/40" />
            ) : (
              <RatingSummary summary={summary} />
            )}
            <ReviewFilters
              sort={sort}
              rating={rating}
              withImagesOnly={withImagesOnly}
              total={total}
              isRefreshing={isRefreshing || isLoading}
              onSortChange={setSort}
              onRatingChange={setRating}
              onWithImagesOnlyChange={setWithImagesOnly}
              onReset={resetFilters}
            />
          </div>

          <div className="min-w-0">
            <h3 className="sr-only">{t("reviews.listTitle")}</h3>

            <div
              aria-busy={isRefreshing}
              className={cn(
                "space-y-5 transition-opacity duration-200",
                isRefreshing && "opacity-60",
              )}
            >
              {isLoading ? (
                Array.from({ length: SKELETON_COUNT }, (_, index) => (
                  <SkeletonCard key={index} className="rounded-3xl border border-bun-line p-5" />
                ))
              ) : hasError ? (
                <div className="rounded-3xl border border-bun-line bg-bun-paper p-6 text-center">
                  <AlertCircle className="mx-auto size-6 text-bun-red" aria-hidden="true" />
                  <p className="mt-3 font-black text-bun-text">{t("reviews.error.title")}</p>
                  <p className="mt-1 text-sm leading-6 text-bun-muted">{t("reviews.error.body")}</p>
                  <Button variant="secondary" className="mt-5" onClick={retry}>
                    <RefreshCw className="size-4" aria-hidden="true" />
                    {t("reviews.error.retry")}
                  </Button>
                </div>
              ) : reviews.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-bun-line bg-bun-surface/40 p-8 text-center">
                  <MessageSquarePlus
                    className="mx-auto size-6 text-bun-orange"
                    aria-hidden="true"
                  />
                  <p className="mt-3 font-black text-bun-text">{t("reviews.empty.title")}</p>
                  <p className="mt-1 text-sm leading-6 text-bun-muted">
                    {t("reviews.empty.body")}
                  </p>
                </div>
              ) : (
                <>
                  {reviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}

                  {hasMore ? (
                    <div className="pt-2 text-center">
                      <Button variant="secondary" onClick={loadMore} disabled={isLoadingMore}>
                        {isLoadingMore ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : null}
                        {isLoadingMore ? t("reviews.loadingMore") : t("reviews.loadMore")}
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="mt-10">
              <ReviewForm onSubmit={submitReview} demoOnly={demoOnly} />
            </div>
          </div>
        </div>
      </div>
    </MotionSection>
  );
}
