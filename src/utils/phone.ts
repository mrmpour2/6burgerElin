/**
 * کمک‌تابع‌های شماره موبایل.
 *
 * کاربر ایرانی ممکن است شماره را با ارقام فارسی/عربی و با فاصله یا خط تیره
 * بنویسد، در حالی که مقایسه‌ها (عضویت باشگاه، لینک سفارش به عضو) باید روی یک
 * مقدار نرمال انجام شوند. بک‌اند هم ارقام فارسی را می‌پذیرد
 * (`paymentController` → الگوی `[+\d۰-۹٠-٩()\-\s]{8,20}`).
 */
const PERSIAN_DIGITS = /[\u06F0-\u06F9]/g;
const ARABIC_DIGITS = /[\u0660-\u0669]/g;

/** ارقام فارسی/عربی را به ارقام لاتین تبدیل می‌کند تا مقایسه‌ها ساده بمانند. */
export function toLatinDigits(value: string): string {
  return value
    .replace(PERSIAN_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(ARABIC_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x0660));
}

/** شماره‌ای که فقط برای مقایسه/ذخیره استفاده می‌شود: ارقام لاتین بدون جداکننده. */
export function normalizePhone(value: string): string {
  return toLatinDigits(value).replace(/[\s()\-\u200c]/g, "");
}

/**
 * اعتبارسنجی سمت کلاینت پیش از ارسال به سرور.
 * سخت‌گیرانه‌تر از الگوی بک‌اند است تا خطای کاربر همان‌جا در فرم دیده شود.
 */
export function isValidPhone(value: string): boolean {
  return /^\+?\d{8,15}$/.test(normalizePhone(value));
}
