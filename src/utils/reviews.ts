import type { Language, ReviewSort, StarRating } from "@/types";
// پسوند صریح `./phone.ts` لازم است تا همین ماژول هم در Vite و هم در تست‌های
// `node --test` (که بدون bundler فایل را می‌خواند) قابل import باشد.
import { isValidPhone, toLatinDigits } from "./phone.ts";

/**
 * منطق خالص بخش نظرات: اعتبارسنجی، آمار و قالب‌بندی.
 *
 * هیچ وابستگی‌ای به React یا شبکه اینجا نیست؛ کامپوننت‌ها و هوک‌ها فقط این
 * توابع را صدا می‌زنند. همین جدابودن باعث می‌شود رفتار فرم/نمودار با تست واحد
 * (`tests/reviews.test.mjs`) بدون مرورگر قابل بررسی باشد.
 */

/** بازهٔ مجاز امتیاز (۱ تا ۵ ستاره). */
export const REVIEW_MIN_RATING = 1;
export const REVIEW_MAX_RATING = 5;

/** محدودیت‌های متن نظر؛ با اعتبارسنجی سرور (`commentValidators.js`) هم‌اندازه‌اند. */
export const REVIEW_MIN_BODY_LENGTH = 10;
export const REVIEW_MAX_BODY_LENGTH = 1000;
export const REVIEW_MAX_NAME_LENGTH = 60;

/** فیلدهای فرم نظر. */
export type ReviewField = "rating" | "name" | "phone" | "body" | "orderNumber";

/**
 * کد خطای هر فیلد (نه پیام آماده).
 *
 * فرم این کدها را با `t()` ترجمه می‌کند؛ این‌طور منطق اعتبارسنجی به زبان رابط
 * کاربری گره نمی‌خورد و متن خطا دوزبانه می‌ماند.
 */
export type ReviewFieldError =
  | "ratingRequired"
  | "nameRequired"
  | "nameTooLong"
  | "phoneInvalid"
  | "bodyRequired"
  | "bodyTooShort"
  | "bodyTooLong"
  | "orderNumberInvalid";

export type ReviewFieldErrors = Partial<Record<ReviewField, ReviewFieldError>>;

/** مقادیر خام فرم ثبت نظر. */
export interface ReviewDraft {
  rating: StarRating | null;
  name: string;
  /** شمارهٔ تماس اختیاری؛ برای پیگیری در پنل مدیریت و امتیاز باشگاه. */
  phone: string;
  body: string;
  orderNumber: string;
}

/** کمینهٔ لازم برای محاسبه‌های آماری روی یک نظر. */
export interface ReviewLike {
  rating: number;
  createdAt: string;
  images: readonly string[];
}

/** قالب شمارهٔ سفارش پنل: `WEB-…-…` (پرداخت آنلاین) یا `ORD-…-…` (سفارش داخلی). */
const ORDER_NUMBER_PATTERN = /^[A-Z0-9]{2,4}-[A-Z0-9]{1,20}-[A-Z0-9]{4,12}$/;

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const dateFormatters = new Map<Language, Intl.DateTimeFormat>();
const numberFormatters = new Map<Language, Intl.NumberFormat>();

/**
 * ورودی نامعلوم را به امتیاز معتبر ۱..۵ تبدیل می‌کند.
 *
 * `null` یعنی ورودی عدد معتبری نیست؛ دادهٔ خراب API باید نادیده گرفته شود، نه
 * اینکه محاسبه‌ها را `NaN` کند.
 */
export function toStarRating(value: unknown): StarRating | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  switch (rounded) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
      return rounded;
    default:
      return null;
  }
}

/**
 * متن کاربر را به متنِ سادهٔ نمایشی تبدیل می‌کند: نویسه‌های کنترلی حذف،
 * فاصله‌های تکراری فشرده و بیش از دو خط خالی پشت‌سرهم نگه داشته نمی‌شود.
 *
 * نکتهٔ امنیتی: هیچ‌جا HTML تولید نمی‌شود و از `dangerouslySetInnerHTML` استفاده
 * نمی‌کنیم؛ React خودش متن را escape می‌کند. این تابع فقط پاکیزگی متن را تضمین
 * می‌کند و نیم‌فاصلهٔ فارسی (`\u200C`) را دست نمی‌زند.
 */
export function toPlainText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARACTERS, "")
    .replace(/[ \t\u00A0]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

/** شمارهٔ سفارش را نرمال می‌کند: ارقام فارسی→لاتین، حذف فاصله، حروف بزرگ. */
export function normalizeOrderNumber(value: string): string {
  return toLatinDigits(value).replace(/\s+/g, "").toUpperCase();
}

/**
 * بررسی قالب شمارهٔ سفارش.
 *
 * فقط قالب بررسی می‌شود؛ تطابق با سفارش واقعی و پرچم «خرید تأییدشده» کار سرور
 * است (کلاینت هرگز نمی‌تواند آن را تأیید کند).
 */
export function isValidOrderNumber(value: string): boolean {
  return ORDER_NUMBER_PATTERN.test(normalizeOrderNumber(value));
}

/** اعتبارسنجی فرم؛ خروجی فقط کد خطاهای موجود است (شیء خالی یعنی معتبر). */
export function validateReviewDraft(draft: ReviewDraft): ReviewFieldErrors {
  const errors: ReviewFieldErrors = {};

  if (draft.rating === null) errors.rating = "ratingRequired";

  const name = draft.name.trim();
  if (!name) errors.name = "nameRequired";
  else if (name.length > REVIEW_MAX_NAME_LENGTH) errors.name = "nameTooLong";

  // شمارهٔ تماس اختیاری است؛ اگر نوشته شد باید معتبر باشد (قالب سخت‌گیرانه‌تر از
  // سرور تا خطا همان‌جا در فرم دیده شود). نبودِ فیلد هم مثل خالی‌بودن آن است تا
  // فراخوان‌های قدیمی (بدون شماره) نشکنند.
  const phone = typeof draft.phone === "string" ? draft.phone.trim() : "";
  if (phone && !isValidPhone(phone)) errors.phone = "phoneInvalid";

  const body = toPlainText(draft.body);
  if (!body) errors.body = "bodyRequired";
  else if (body.length < REVIEW_MIN_BODY_LENGTH) errors.body = "bodyTooShort";
  else if (body.length > REVIEW_MAX_BODY_LENGTH) errors.body = "bodyTooLong";

  const orderNumber = draft.orderNumber.trim();
  if (orderNumber && !isValidOrderNumber(orderNumber)) errors.orderNumber = "orderNumberInvalid";

  return errors;
}

/** آیا فرم خطایی دارد؟ */
export function hasReviewErrors(errors: ReviewFieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/** تعداد نظر هر ستاره؛ خروجی همیشه هر پنج کلید را دارد (برای نمودار). */
export function ratingDistribution(reviews: readonly ReviewLike[]): Record<StarRating, number> {
  const distribution: Record<StarRating, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const review of reviews) {
    const rating = toStarRating(review.rating);
    if (rating !== null) distribution[rating] += 1;
  }
  return distribution;
}

/** میانگین امتیاز با یک رقم اعشار؛ بدون نظر صفر برمی‌گردد. */
export function averageRating(reviews: readonly ReviewLike[]): number {
  if (reviews.length === 0) return 0;
  const total = reviews.reduce((sum, review) => sum + (toStarRating(review.rating) ?? 0), 0);
  return Math.round((total / reviews.length) * 10) / 10;
}

/** خلاصهٔ آماری فهرست نظرات (میانگین، تعداد، پراکندگی). */
export function summarizeReviews(reviews: readonly ReviewLike[]): {
  average: number;
  total: number;
  distribution: Record<StarRating, number>;
} {
  return {
    average: averageRating(reviews),
    total: reviews.length,
    distribution: ratingDistribution(reviews),
  };
}

/** سهم یک ستاره از کل نظرات به درصد (۰..۱۰۰) برای پهنای میلهٔ نمودار. */
export function starShare(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

/** فیلتر فهرست نظرات بر اساس ستاره و داشتن تصویر. */
export function filterReviews<T extends ReviewLike>(
  reviews: readonly T[],
  options: { rating?: StarRating | null; withImagesOnly?: boolean },
): T[] {
  const { rating = null, withImagesOnly = false } = options;
  return reviews.filter((review) => {
    if (rating !== null && toStarRating(review.rating) !== rating) return false;
    if (withImagesOnly && review.images.length === 0) return false;
    return true;
  });
}

/** مرتب‌سازی پایدار فهرست نظرات؛ ورودی تغییر نمی‌کند (خروجی آرایهٔ تازه است). */
export function sortReviews<T extends ReviewLike>(reviews: readonly T[], sort: ReviewSort): T[] {
  const sorted = [...reviews];
  const time = (review: ReviewLike): number => Date.parse(review.createdAt) || 0;

  switch (sort) {
    case "oldest":
      return sorted.sort((a, b) => time(a) - time(b));
    case "highest":
      return sorted.sort((a, b) => b.rating - a.rating || time(b) - time(a));
    case "lowest":
      return sorted.sort((a, b) => a.rating - b.rating || time(b) - time(a));
    default:
      return sorted.sort((a, b) => time(b) - time(a));
  }
}

/** تاریخ نظر به زبان انتخابی؛ ورودی نامعتبر رشتهٔ خالی برمی‌گرداند. */
export function formatReviewDate(iso: string, language: Language): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const cached = dateFormatters.get(language);
  const formatter =
    cached ??
    new Intl.DateTimeFormat(language === "fa" ? "fa-IR" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  if (!cached) dateFormatters.set(language, formatter);

  return formatter.format(date);
}

/** عدد را با ارقام زبان انتخابی می‌نویسد (تعداد نظر، میانگین، درصد). */
export function formatReviewNumber(value: number, language: Language): string {
  const cached = numberFormatters.get(language);
  const formatter = cached ?? new Intl.NumberFormat(language === "fa" ? "fa-IR" : "en-US");
  if (!cached) numberFormatters.set(language, formatter);

  return formatter.format(value);
}

/**
 * بررسی امنیتی نشانی تصویر پیوست نظر.
 *
 * تصاویر از سمت کاربر/پنل می‌آیند، پس فقط `https://` و مسیرهای نسبیِ خودِ سایت
 * (`/uploads/...`) مجاز هستند؛ این‌طور `javascript:`، `data:` و `http://` ناامن
 * هرگز در `src` قرار نمی‌گیرند. خروجی `null` یعنی تصویر را نمایش نده.
 */
export function safeReviewImage(value: string): string | null {
  const url = value.trim();
  if (!url) return null;
  if (/^https:\/\//i.test(url)) return url;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return null;
}
