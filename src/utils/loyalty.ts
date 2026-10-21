/**
 * ثابت‌های نمایشی باشگاه مشتریان.
 *
 * امتیازدهی و سطح‌بندی کاملاً در بک‌اند انجام می‌شود
 * (`dashboard/backend/src/services/clubService.js`) و این ماژول فقط اعدادی را
 * نگه می‌دارد که برای متن راهنمای فرم/صفحه لازم است. هیچ دفترچهٔ محلی یا تابع
 * امتیازدهی سمت مرورگر وجود ندارد تا دو منبع حقیقت نسازیم.
 */

/**
 * امتیازی که هر نظرِ تأییدشدهٔ عضو باشگاه اضافه می‌کند.
 * باید با `POINTS_PER_REVIEW` در سرویس باشگاه یکی بماند.
 */
export const POINTS_PER_REVIEW = 50;

const numberFormatters = new Map<string, Intl.NumberFormat>();

/** عدد باشگاه را با ارقام زبان رابط می‌نویسد (امتیاز، موجودی، مقدار پیشرفت). */
export function formatLoyaltyNumber(value: number, language: "fa" | "en"): string {
  let formatter = numberFormatters.get(language);
  if (!formatter) {
    formatter = new Intl.NumberFormat(language === "fa" ? "fa-IR" : "en-US");
    numberFormatters.set(language, formatter);
  }
  return formatter.format(Number.isFinite(value) ? value : 0);
}

