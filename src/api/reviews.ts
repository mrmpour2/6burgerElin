import { isAxiosError } from "axios";
import { apiClient } from "./client";
import { buildDemoReviewPage } from "@/data/demoReviews";
import type {
  Language,
  ProductReview,
  ReviewPage,
  ReviewSort,
  ReviewSource,
  ReviewSummary,
  StarRating,
} from "@/types";
import { normalizeOrderNumber, toStarRating } from "@/utils/reviews";

/**
 * لایهٔ نظرات وب‌سایت: خواندن فهرست و ثبت نظر جدید.
 *
 * قرارداد با بک‌اند Express (هم‌نام با بقیهٔ مسیرهای عمومی سایت):
 *
 *   GET  /api/public/reviews?productId=…&page=1&pageSize=6&sort=newest[&rating=5][&withImages=1]
 *        → { items: Review[], summary: { average, total, distribution }, total, page, hasMore }
 *   POST /api/public/reviews
 *        ← { productId, authorName, rating, body, orderNumber?, authorPhone? }
 *        → { review: { id, status } }   // status پیش‌فرض PENDING
 *
 * تا وقتی این مسیر در بک‌اند ساخته نشده، درخواست‌ها ۴۰۴ می‌گیرند (و در هاست
 * استاتیک به `index.html` می‌رسند و پاسخ غیر-JSON می‌آید) و ما به‌جای نمایش خطا،
 * دادهٔ آزمایشیِ هم‌شکل (`data/demoReviews.ts`) را با پرچم `source: "demo"`
 * برمی‌گردانیم تا رابط کاربری کامل و قابل استفاده بماند. خطاهای واقعی دیگر
 * (۵۰۰، بدنهٔ JSON با شکل نادرست، خطای ثبت) بالا می‌روند و رابط کاربری حالت
 * خطا/تلاش دوباره را نشان می‌دهد.
 */

/** تعداد نظر در هر صفحه؛ کوچک نگه داشته شده تا اولین رندر سبک بماند. */
export const REVIEW_PAGE_SIZE = 6;

/** سقف تعداد پاسخ کش‌شده؛ از رشد بی‌نهایت حافظه با ترکیب فیلترها جلوگیری می‌کند. */
const REVIEW_CACHE_LIMIT = 24;

export interface ReviewQuery {
  /** شناسهٔ محصول در دیتابیس پنل (`MenuItem.productId`). */
  productId: string;
  /** زبان رابط کاربری؛ برای متن‌های دادهٔ آزمایشی لازم است. */
  language: Language;
  page?: number;
  pageSize?: number;
  sort?: ReviewSort;
  rating?: StarRating | null;
  withImagesOnly?: boolean;
  /**
   * `true` یعنی این محصول شناسهٔ دیتابیس ندارد (آیتم ثابت کاتالوگ) و نظری برای
   * گرفتن وجود ندارد؛ مستقیم دادهٔ آزمایشی برگردانده می‌شود.
   */
  demoOnly?: boolean;
}

/** ورودی ثبت نظر (بعد از اعتبارسنجی سمت کلاینت در `utils/reviews.ts`). */
export interface ReviewSubmissionInput {
  productId: string;
  language: Language;
  authorName: string;
  rating: StarRating;
  body: string;
  /** شمارهٔ سفارش اختیاری؛ سرور با آن پرچم «خرید تأییدشده» را ست می‌کند. */
  orderNumber?: string;
  /**
   * شمارهٔ تماس اختیاری (نرمال‌شده، ارقام لاتین). سرور آن را فقط برای پیگیری در
   * پنل مدیریت ذخیره می‌کند و هرگز در پاسخ‌های عمومی برنمی‌گرداند.
   */
  authorPhone?: string;
  demoOnly?: boolean;
}

/** نتیجهٔ ثبت نظر. */
export interface SubmittedReview {
  id: string;
  /** نظر تازه همیشه `pending` است تا تیم آن را بررسی کند. */
  status: "pending" | "approved";
  source: ReviewSource;
}


/* -------------------------------------------------------------------------- */
/* نرمال‌سازی پاسخ سرور                                                       */
/* -------------------------------------------------------------------------- */

/**
 * فهرست تصاویر را امن می‌کند: فقط رشته‌ها، حداکثر ۴ تصویر.
 * بررسی امنیتی نهاییِ نشانی در `safeReviewImage` انجام می‌شود.
 */
function toReviewImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").slice(0, 4);
}

/** پاسخ رستوران؛ اگر بدنه یا تاریخ معتبر نباشد `null` برمی‌گردد. */
function toRestaurantReply(value: unknown): ProductReview["reply"] {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const body = typeof record.body === "string" ? record.body.trim() : "";
  const createdAt = typeof record.createdAt === "string" ? record.createdAt : "";
  if (!body || Number.isNaN(Date.parse(createdAt))) return null;
  return { body, createdAt };
}

/**
 * تبدیل یک رکورد خام API به `ProductReview`.
 *
 * دادهٔ سرور «نامعلوم» فرض می‌شود: هر رکوردی که شناسه/امتیاز/متن معتبر نداشته
 * باشد کنار گذاشته می‌شود تا یک سطر خراب کل بخش نظرات را خراب نکند.
 */
function toProductReview(raw: unknown, fallbackProductId: string): ProductReview | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;

  const id = typeof record.id === "string" ? record.id.trim() : "";
  const body = typeof record.body === "string" ? record.body.trim() : "";
  const rating = toStarRating(record.rating);
  if (!id || !body || rating === null) return null;

  const rawDate = typeof record.createdAt === "string" ? record.createdAt : "";
  const createdAt = Number.isNaN(Date.parse(rawDate)) ? new Date().toISOString() : rawDate;
  const productId =
    typeof record.productId === "string" && record.productId ? record.productId : fallbackProductId;

  return {
    id,
    productId,
    authorName: typeof record.authorName === "string" ? record.authorName.trim() : "",
    rating,
    body,
    createdAt,
    images: toReviewImages(record.images),
    orderVerified: record.orderVerified === true,
    status: record.status === "pending" || record.status === "PENDING" ? "pending" : "published",
    reply: toRestaurantReply(record.reply),
  };
}

/** خلاصهٔ امتیازها؛ در نبود فیلدهای معتبر از خودِ نظرهای همین صفحه حساب می‌شود. */
function toReviewSummary(value: unknown, fallback: readonly ProductReview[]): ReviewSummary {
  const distribution: Record<StarRating, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  if (typeof value !== "object" || value === null) {
    for (const review of fallback) distribution[review.rating] += 1;
    const average = fallback.length
      ? Math.round((fallback.reduce((sum, review) => sum + review.rating, 0) / fallback.length) * 10) / 10
      : 0;
    return { average, total: fallback.length, distribution };
  }

  const record = value as Record<string, unknown>;
  const rawDistribution = record.distribution;
  if (typeof rawDistribution === "object" && rawDistribution !== null) {
    const counts = rawDistribution as Record<string, unknown>;
    for (const star of [1, 2, 3, 4, 5] as const) {
      const count = counts[String(star)];
      if (typeof count === "number" && Number.isFinite(count) && count > 0) distribution[star] = count;
    }
  }

  const average = typeof record.average === "number" && Number.isFinite(record.average) ? record.average : 0;
  const total = typeof record.total === "number" && Number.isFinite(record.total) ? record.total : 0;

  return { average, total, distribution };
}

/**
 * تبدیل پاسخ فهرست به `ReviewPage`.
 *
 * `items` یا `reviews` هر دو پذیرفته می‌شوند تا اگر بک‌اند نام آرایه را
 * `reviews` گذاشت، رابط کاربری نشکند.
 */
function toReviewPage(value: unknown, query: ReviewQuery): ReviewPage | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const rawItems = Array.isArray(record.items)
    ? record.items
    : Array.isArray(record.reviews)
      ? record.reviews
      : null;
  if (!rawItems) return null;

  const items = rawItems
    .map((item) => toProductReview(item, query.productId))
    .filter((item): item is ProductReview => item !== null);

  const page = typeof record.page === "number" && record.page > 0 ? record.page : (query.page ?? 1);
  const total = typeof record.total === "number" && record.total >= 0 ? record.total : items.length;
  const pageSize = query.pageSize ?? REVIEW_PAGE_SIZE;

  return {
    items,
    summary: toReviewSummary(record.summary, items),
    total,
    page,
    hasMore: typeof record.hasMore === "boolean" ? record.hasMore : page * pageSize < total,
    source: "api",
  };
}

/* -------------------------------------------------------------------------- */
/* کش، حالت آزمایشی و درخواست‌ها                                              */
/* -------------------------------------------------------------------------- */

/** آخرین پاسخ‌های موفق API؛ کلید = ترکیب محصول/صفحه/فیلترها. */
const reviewCache = new Map<string, ReviewPage>();

/**
 * نظرهای ثبت‌شده در همین نشستِ مرورگر در حالت آزمایشی.
 *
 * بک‌اند نظرات وجود ندارد، پس ثبت واقعی ممکن نیست؛ برای اینکه کاربر وضعیت
 * «در انتظار تأیید» را ببیند، نظر او فقط در حافظهٔ همین تب نگه داشته می‌شود و
 * با رفرش صفحه از بین می‌رود. هیچ‌جا ادعا نمی‌کنیم روی سرور ذخیره شده است:
 * بنر «دادهٔ آزمایشی» بالای بخش همیشه در این حالت دیده می‌شود.
 */
const demoSubmissions = new Map<string, ProductReview[]>();

/** پاک‌کردن کش؛ بعد از ثبت نظر صدا زده می‌شود تا فهرست تازه خوانده شود. */
export function resetReviewCache(): void {
  reviewCache.clear();
}

function cacheKey(query: ReviewQuery): string {
  return [
    query.productId,
    query.page ?? 1,
    query.pageSize ?? REVIEW_PAGE_SIZE,
    query.sort ?? "newest",
    query.rating ?? "-",
    query.withImagesOnly ? "images" : "-",
  ].join("|");
}

/**
 * آیا این خطا یعنی «مسیر نظرات در بک‌اند وجود ندارد»؟
 *
 * بدون پاسخ = شبکه/سرور در دسترس نیست؛ ۴۰۴/۵۰۱ = مسیر ساخته نشده است.
 * در این دو حالت به‌جای خطا دادهٔ آزمایشی نشان می‌دهیم. خطاهای دیگر (۵۰۰،
 * ۴۰۰، پاسخ نامعتبر) واقعی‌اند و باید به کاربر دیده شوند.
 */
function isBackendUnavailable(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === undefined || status === 404 || status === 501;
}

/** صفحهٔ دادهٔ آزمایشی، همراه با نظرهای ثبت‌شدهٔ همین نشست. */
function demoPageFor(query: ReviewQuery): ReviewPage {
  return buildDemoReviewPage({
    productId: query.productId,
    language: query.language,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? REVIEW_PAGE_SIZE,
    sort: query.sort ?? "newest",
    rating: query.rating ?? null,
    withImagesOnly: query.withImagesOnly ?? false,
    pending: demoSubmissions.get(query.productId) ?? [],
  });
}

/**
 * فهرست نظرات یک محصول.
 *
 * پاسخ موفق API کش می‌شود تا با برگشتن به همین محصول (یا تغییر فیلتر و برگشت)
 * درخواست تکراری زده نشود. کش فقط برای پاسخ واقعی است؛ در حالت آزمایشی هر بار
 * داده تازه ساخته می‌شود تا نظر تازه‌ثبت‌شدهٔ کاربر هم در فهرست دیده شود.
 */
export async function fetchProductReviews(query: ReviewQuery): Promise<ReviewPage> {
  if (query.demoOnly) return demoPageFor(query);

  const key = cacheKey(query);
  const cached = reviewCache.get(key);
  if (cached) return cached;

  try {
    const response = await apiClient.get("/public/reviews", {
      params: {
        productId: query.productId,
        page: query.page ?? 1,
        pageSize: query.pageSize ?? REVIEW_PAGE_SIZE,
        sort: query.sort ?? "newest",
        ...(query.rating ? { rating: query.rating } : null),
        ...(query.withImagesOnly ? { withImages: 1 } : null),
      },
    });

    // هاست استاتیک برای مسیرهای ناشناخته `index.html` برمی‌گرداند؛ بدنهٔ غیر-JSON
    // یعنی «مسیر نظرات وجود ندارد»، نه اینکه API خراب پاسخ داده باشد.
    if (typeof response.data === "string") return demoPageFor(query);

    const page = toReviewPage(response.data, query);
    if (!page) throw new Error("پاسخ نامعتبر از API نظرات");

    if (reviewCache.size >= REVIEW_CACHE_LIMIT) reviewCache.clear();
    reviewCache.set(key, page);
    return page;
  } catch (error) {
    if (isBackendUnavailable(error)) return demoPageFor(query);
    throw error;
  }
}

/** ساخت نظر «در انتظار تأیید» در حافظهٔ همین نشست (فقط حالت آزمایشی). */
function storeDemoSubmission(input: ReviewSubmissionInput): ProductReview {
  const pending: ProductReview = {
    id: `demo-${Date.now()}`,
    productId: input.productId,
    authorName: input.authorName,
    rating: input.rating,
    body: input.body,
    createdAt: new Date().toISOString(),
    images: [],
    orderVerified: false,
    status: "pending",
    reply: null,
  };

  const list = demoSubmissions.get(input.productId) ?? [];
  demoSubmissions.set(input.productId, [pending, ...list]);
  return pending;
}

/** پاسخ ثبت نظر؛ اگر سرور شناسه نداده باشد یک شناسهٔ محلی ساخته می‌شود. */
function toSubmittedReview(value: unknown, source: ReviewSource): SubmittedReview {
  const record = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const nested =
    typeof record.review === "object" && record.review !== null
      ? (record.review as Record<string, unknown>)
      : record;

  const id = typeof nested.id === "string" && nested.id ? nested.id : `local-${Date.now()}`;
  const status = nested.status === "APPROVED" || nested.status === "approved" ? "approved" : "pending";

  return { id, status, source };
}

/**
 * ثبت نظر جدید.
 *
 * سرور باید همان قواعد اعتبارسنجی سمت کلاینت را دوباره بررسی کند (بازهٔ امتیاز،
 * طول متن، قالب شمارهٔ سفارش) و درخواست را نرخ‌محدود کند؛ این تابع فقط دادهٔ
 * آمادهٔ ارسال را می‌فرستد و هیچ‌وقت خودش پرچم «خرید تأییدشده» را ست نمی‌کند.
 */
export async function submitProductReview(input: ReviewSubmissionInput): Promise<SubmittedReview> {
  if (input.demoOnly) {
    const pending = storeDemoSubmission(input);
    return { id: pending.id, status: "pending", source: "demo" };
  }

  try {
    const response = await apiClient.post("/public/reviews", {
      productId: input.productId,
      authorName: input.authorName,
      rating: input.rating,
      body: input.body,
      ...(input.orderNumber ? { orderNumber: normalizeOrderNumber(input.orderNumber) } : null),
      ...(input.authorPhone ? { authorPhone: input.authorPhone } : null),
    });

    resetReviewCache();
    return toSubmittedReview(response.data, "api");
  } catch (error) {
    if (isBackendUnavailable(error)) {
      const pending = storeDemoSubmission(input);
      return { id: pending.id, status: "pending", source: "demo" };
    }
    throw error;
  }
}

