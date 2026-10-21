/**
 * شناسه نشست مهمان.
 *
 * یک مقدار تصادفی که در `localStorage` نگه داشته می‌شود و هم گفتگوی دستیار
 * (`POST /api/chat`) و هم سفارش‌های ثبت‌شده را به یک «مکالمه» در پنل وصل می‌کند
 * (بک‌اند با همین `sessionId` سفارش را به گفتگو لینک می‌کند).
 *
 * قالب مقدار باید با اعتبارسنجی بک‌اند جور باشد: ۲۰ تا ۱۰۰ کاراکتر `[\w-]`.
 */
const SESSION_KEY = "store-chat-session-id";
const SESSION_PATTERN = /^[\w-]{20,100}$/;

function createSessionId(): string {
  const uuid = window.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/** شناسه نشست ذخیره‌شده، یا یک شناسه تازه که بلافاصله ذخیره می‌شود. */
export function getChatSessionId(): string {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing && SESSION_PATTERN.test(existing)) return existing;
    const next = createSessionId();
    window.localStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    // حالت private/مسدود: نشست فقط برای همین بارگذاری زنده است.
    return createSessionId();
  }
}
