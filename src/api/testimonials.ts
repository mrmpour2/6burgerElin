import { apiClient } from "./client";
import type { TableTalkTestimonial } from "@/types";
import { TABLE_TALK_LIMIT, toTableTalkTestimonial } from "@/utils/tableTalk";

/**
 * لایهٔ «Table Talk» صفحهٔ اصلی: خواندن روایت‌هایی که مدیر در پنل انتخاب کرده
 * است.
 *
 * قرارداد با بک‌اند Express (مسیر عمومی، بدون توکن):
 *
 *   GET /api/public/testimonials?limit=12
 *        → { items: [{ id, authorName, authorNameEn, body, bodyEn, rating,
 *                      orderVerified, createdAt, productName }], total }
 *
 * سرور فقط نظرهای `APPROVED` را برمی‌گرداند و از میان آن‌ها فقط آن‌هایی که پرچم
 * «نمایش در Table Talk صفحهٔ اصلی» دارند.
 *
 * اگر درخواست شکست بخورد هیچ دادهٔ ساختگی جایگزین نمی‌شود: خطا به لایهٔ رابط
 * می‌رسد و بخش Table Talk یک پیام کوتاه با دکمهٔ تلاش دوباره نشان می‌دهد (و اگر
 * فهرست واقعاً خالی باشد، کل بخش پنهان می‌ماند).
 */

export interface TableTalkFeed {
  items: TableTalkTestimonial[];
  /** `api` یعنی پاسخ واقعی بک‌اند. */
  source: "api";
}

/** آخرین فید موفق؛ برای نمایش فوری هنگام بازگشت به صفحهٔ اصلی. */
let feedCache: TableTalkFeed | null = null;
let feedRequest: Promise<TableTalkFeed> | null = null;

/** فید کش‌شده اگر تا این لحظه رسیده باشد، وگرنه `null`. */
export function peekTableTalk(): TableTalkFeed | null {
  return feedCache;
}

async function requestTableTalk(): Promise<TableTalkFeed> {
  const response = await apiClient.get("/public/testimonials", {
    params: { limit: TABLE_TALK_LIMIT },
  });

  const rawItems = (response.data as { items?: unknown } | null)?.items;
  if (!Array.isArray(rawItems)) throw new Error("پاسخ نامعتبر از API روایت‌ها");

  const items = rawItems
    .map(toTableTalkTestimonial)
    .filter((item): item is TableTalkTestimonial => item !== null);

  return { items, source: "api" };
}

/**
 * فید Table Talk.
 *
 * نتیجهٔ موفق کش می‌شود (درخواست تکراری بین بازدیدهای صفحه زده نمی‌شود) ولی
 * نتیجهٔ خطا کش **نمی‌شود** تا دکمهٔ «تلاش دوباره» واقعاً دوباره درخواست بزند.
 */
export function fetchTableTalk(): Promise<TableTalkFeed> {
  if (feedCache) return Promise.resolve(feedCache);

  feedRequest ??= requestTableTalk()
    .then((feed) => {
      feedCache = feed;
      return feed;
    })
    .catch((error: unknown) => {
      feedRequest = null;
      throw error;
    });

  return feedRequest;
}

/** پاک‌کردن کش و گرفتن فید تازه (دکمهٔ تلاش دوباره). */
export function refreshTableTalk(): Promise<TableTalkFeed> {
  feedCache = null;
  feedRequest = null;
  return fetchTableTalk();
}
