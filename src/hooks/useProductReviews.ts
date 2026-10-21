import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  REVIEW_PAGE_SIZE,
  fetchProductReviews,
  resetReviewCache,
  submitProductReview,
  type ReviewSubmissionInput,
  type SubmittedReview,
} from "@/api/reviews";
import { useLanguage } from "@/hooks/useLanguage";
import { normalizePhone } from "@/utils/phone";
import type {
  ProductReview,
  ReviewSort,
  ReviewSource,
  ReviewSummary,
  StarRating,
} from "@/types";

/** مقادیر فرم ثبت نظر (بدون شناسهٔ محصول و زبان، که خودِ هوک اضافه می‌کند). */
export interface ReviewFormValues {
  authorName: string;
  rating: StarRating;
  body: string;
  orderNumber: string;
  /** شمارهٔ تماس اختیاری؛ همان‌جا در فرم اعتبارسنجی می‌شود. */
  phone: string;
}

export interface ProductReviewsState {
  reviews: ProductReview[];
  summary: ReviewSummary;
  /** `null` تا رسیدن اولین پاسخ. */
  source: ReviewSource | null;
  /** بار اول و بدون داده (نمایش اسکلتون) — تغییر فیلتر این را `true` نمی‌کند. */
  isLoading: boolean;
  /** بارگذاری دوباره به‌خاطر تغییر فیلتر/مرتب‌سازی (فهرست قبلی روی صفحه می‌ماند). */
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  /** تعداد نظرهای منطبق با فیلتر فعلی. */
  total: number;
  /** بارگذاری صفحهٔ اول شکست خورده و چیزی برای نمایش نداریم. */
  hasError: boolean;
  loadMore: () => void;
  retry: () => void;
  submitReview: (values: ReviewFormValues) => Promise<SubmittedReview>;
}

export interface UseProductReviewsOptions {
  /** شناسهٔ محصول در دیتابیس پنل. */
  productId: string;
  /** آیتم ثابت کاتالوگ شناسهٔ دیتابیس ندارد؛ نظرش فقط دادهٔ آزمایشی است. */
  demoOnly?: boolean;
  sort: ReviewSort;
  rating: StarRating | null;
  withImagesOnly: boolean;
}

const EMPTY_SUMMARY: ReviewSummary = {
  average: 0,
  total: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

/**
 * وضعیت کامل بخش نظرات یک محصول: فهرست، خلاصهٔ امتیازها، صفحه‌بندی و ثبت نظر.
 *
 * حالت‌های بارگذاری جدا هستند تا صفحه نلرزد:
 *  - بار اول: `isLoading` → اسکلتون
 *  - تغییر فیلتر/مرتب‌سازی: `isRefreshing` → فهرست قبلی می‌ماند
 *  - «نظرهای بیشتر»: `isLoadingMore` → فقط دکمه اسپین می‌شود
 *  - شکست بارگذاری صفحهٔ اول: `hasError` → کارت خطا با تلاش دوباره
 *
 * پاسخ‌های دیررس با `requestIdRef` نادیده گرفته می‌شوند تا تغییر سریع فیلترها
 * نتیجهٔ قدیمی را روی صفحه نگذارد.
 */
export function useProductReviews(options: UseProductReviewsOptions): ProductReviewsState {
  const { productId, demoOnly = false, sort, rating, withImagesOnly } = options;
  const language = useLanguage();

  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>(EMPTY_SUMMARY);
  const [source, setSource] = useState<ReviewSource | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  // از ابتدا `true` است چون mount همیشه با یک بارگذاری همراه است؛ این‌طور
  // قاب اول به‌جای «نظری ثبت نشده» اسکلتون نشان می‌دهد.
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasError, setHasError] = useState(false);

  const requestIdRef = useRef(0);
  const loadedOnceRef = useRef(false);

  const load = useCallback(
    async (targetPage: number, mode: "replace" | "append") => {
      const requestId = ++requestIdRef.current;
      if (mode === "append") setIsLoadingMore(true);
      else setIsRefreshing(true);

      try {
        const page = await fetchProductReviews({
          productId,
          demoOnly,
          language,
          sort,
          rating,
          withImagesOnly,
          page: targetPage,
          pageSize: REVIEW_PAGE_SIZE,
        });
        if (requestId !== requestIdRef.current) return;

        setReviews((current) => (mode === "append" ? [...current, ...page.items] : page.items));
        setSummary(page.summary);
        setSource(page.source);
        setTotal(page.total);
        setHasMore(page.hasMore);
        setHasError(false);
        loadedOnceRef.current = true;
      } catch {
        if (requestId !== requestIdRef.current) return;
        // شکست در «صفحهٔ بعد» نباید فهرست موجود را پاک کند؛ فقط دکمه برمی‌گردد.
        if (mode === "append") setHasMore(false);
        else if (!loadedOnceRef.current) setHasError(true);
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoadingMore(false);
          setIsRefreshing(false);
        }
      }
    },
    [productId, demoOnly, language, sort, rating, withImagesOnly],
  );

  // بارگذاری صفحهٔ اول؛ با هر تغییر فیلتر/مرتب‌سازی/محصول/زبان دوباره اجرا می‌شود.
  useEffect(() => {
    void load(1, "replace");
  }, [load]);

  const loadMore = useCallback(() => {
    if (isLoadingMore || isRefreshing || !hasMore) return;
    const nextPage = Math.floor(reviews.length / REVIEW_PAGE_SIZE) + 1;
    void load(nextPage, "append");
  }, [hasMore, isLoadingMore, isRefreshing, load, reviews.length]);

  const retry = useCallback(() => {
    loadedOnceRef.current = false;
    setHasError(false);
    void load(1, "replace");
  }, [load]);

  /**
   * ثبت نظر و تازه‌سازی فهرست.
   *
   * خطای واقعی سرور (نرخ‌محدودی، اعتبارسنجی، قطع شبکه) از همین‌جا بالا می‌رود و
   * فرم آن را در پنل خطا نشان می‌دهد؛ پس هوک خطا را «قورت» نمی‌دهد.
   */
  const submitReview = useCallback(
    async (values: ReviewFormValues): Promise<SubmittedReview> => {
      // شمارهٔ تماس پیش از ارسال نرمال می‌شود تا سرور و دفترچهٔ اعضای باشگاه روی
      // یک مقدار مقایسه کنند («۰۹۱۲ ۳۴۵ ۶۷۸۹» = «09123456789»).
      const phone = normalizePhone(values.phone);
      const input: ReviewSubmissionInput = {
        productId,
        demoOnly,
        language,
        authorName: values.authorName.trim(),
        rating: values.rating,
        body: values.body,
        ...(values.orderNumber.trim() ? { orderNumber: values.orderNumber.trim() } : null),
        ...(phone ? { authorPhone: phone } : null),
      };

      const result = await submitProductReview(input);
      resetReviewCache();
      await load(1, "replace");
      return result;
    },
    [productId, demoOnly, language, load],
  );

  return useMemo(
    () => ({
      reviews,
      summary,
      source,
      isLoading: isRefreshing && reviews.length === 0,
      isRefreshing: isRefreshing && reviews.length > 0,
      isLoadingMore,
      hasMore,
      total,
      hasError: hasError && reviews.length === 0,
      loadMore,
      retry,
      submitReview,
    }),
    [
      reviews,
      summary,
      source,
      isRefreshing,
      isLoadingMore,
      hasMore,
      total,
      hasError,
      loadMore,
      retry,
      submitReview,
    ],
  );
}

