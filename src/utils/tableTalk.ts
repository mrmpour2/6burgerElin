import type { LocalizedText, TableTalkTestimonial } from "@/types";

/**
 * منطق خالص بخش «Table Talk» صفحهٔ اصلی.
 *
 * این ماژول عمداً هیچ وابستگی‌ای به React، DOM یا شبکه ندارد تا هم در مرورگر و
 * هم زیر `node --test` اجرا شود (نگاه کنید به `tests/tableTalk.test.mjs`).
 * درخواست شبکه در `src/api/testimonials.ts` و وضعیت React در
 * `src/hooks/useTableTalk.ts` است.
 */

/** سقف روایت‌های نمایش‌داده‌شده در صفحهٔ اصلی؛ هم‌سبک با سقف سرور. */
export const TABLE_TALK_LIMIT = 12;

/** رشتهٔ تمیزشده؛ هر نوع دیگری رشتهٔ خالی می‌شود. */
export function tableTalkText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** امتیاز فقط عدد صحیح ۱ تا ۵ است؛ هر چیز دیگری «بدون امتیاز» می‌شود. */
export function toTableTalkRating(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value >= 1 && value <= 5 ? value : null;
}

/** متن دوزبانه؛ اگر ترجمهٔ انگلیسی نبود همان متن فارسی در هر دو زبان می‌رود. */
export function toLocalizedText(fa: string, en: string): LocalizedText {
  return { fa, en: en || fa };
}

/**
 * تبدیل یک رکورد خام API به روایت آمادهٔ نمایش.
 *
 * دادهٔ سرور «نامعلوم» فرض می‌شود: هر رکوردی که شناسه یا متن معتبر نداشته باشد
 * کنار گذاشته می‌شود (`null`) تا یک سطر خراب کل بخش را خراب نکند.
 */
export function toTableTalkTestimonial(raw: unknown): TableTalkTestimonial | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;

  const id = tableTalkText(record.id);
  const body = tableTalkText(record.body);
  if (!id || !body) return null;

  const authorName = tableTalkText(record.authorName);
  const productName = tableTalkText(record.productName);
  const rawDate = tableTalkText(record.createdAt);

  return {
    id,
    name: toLocalizedText(authorName, tableTalkText(record.authorNameEn)),
    quote: toLocalizedText(body, tableTalkText(record.bodyEn)),
    rating: toTableTalkRating(record.rating),
    orderVerified: record.orderVerified === true,
    createdAt: Number.isNaN(Date.parse(rawDate)) ? "" : rawDate,
    productName: productName || null,
  };
}

/**
 * شمارهٔ روایت بعدی/قبلی با چرخش (اسلایدر).
 *
 * فهرست خالی همیشه صفر می‌دهد و مقدار نامعتبر (NaN/اعشاری) تمیز می‌شود تا
 * `items[index]` هرگز `undefined` نشود.
 */
export function stepTableTalkIndex(current: number, total: number, direction: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  const size = Math.trunc(total);
  const base = Number.isFinite(current) ? Math.trunc(current) : 0;
  return (((base + direction) % size) + size) % size;
}
