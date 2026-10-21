/**
 * «سفارش در انتظار نتیجه پرداخت».
 *
 * پرداخت آنلاین زیبال مرورگر را به درگاه می‌برد و بک‌اند پس از تأیید، کاربر را
 * به `${FRONTEND_URL}/?payment=success` برمی‌گرداند. آن لحظه دیگر هیچ state
 * زنده‌ای از سبد باقی نمانده، پس مبلغ و شماره تماس پیش از رفتن به درگاه اینجا
 * ذخیره می‌شود تا بعد از بازگشت بتوان امتیاز باشگاه را ثبت و سبد را خالی کرد.
 */
export interface PendingOrderReward {
  /** شناسه سفارش در دیتابیس؛ برای تلاش دوباره به‌جای ساخت سفارش تکراری. */
  orderId: string;
  orderNumber: string;
  /** مبلغ نهایی سفارش به تومان. */
  total: number;
  /** شماره تماسی که سفارش با آن ثبت شده (برای یافتن عضو باشگاه). */
  phone: string;
  createdAt: string;
  /**
   * «اثر انگشت» سبد در لحظه ساخت سفارش (کلید و تعداد هر سطر).
   *
   * صفحه تسویه با مقایسه این مقدار و سبد فعلی می‌فهمد آیا سبد بعد از ساخت سفارش
   * عوض شده است یا نه؛ اگر عوض شده باشد، همان سفارش قدیمی پرداخت نمی‌شود (وگرنه
   * اقلام/مبلغی که مشتری می‌بیند با سفارش ثبت‌شده تفاوت داشت). رکوردهای قدیمی
   * این فیلد را ندارند و مثل قبل پذیرفته می‌شوند.
   */
  cartKey?: string;
}

const STORAGE_KEY = "شیش برگر الین-pending-order-v1";

function isPendingOrderReward(value: unknown): value is PendingOrderReward {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.orderId === "string" &&
    record.orderId.length > 0 &&
    typeof record.orderNumber === "string" &&
    typeof record.total === "number" &&
    Number.isFinite(record.total) &&
    typeof record.phone === "string" &&
    typeof record.createdAt === "string" &&
    (record.cartKey === undefined || typeof record.cartKey === "string")
  );
}

/** ثبت سفارشی که منتظر تأیید درگاه است. */
export function rememberPendingOrder(record: PendingOrderReward): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // نبود storage نباید مسیر پرداخت را متوقف کند.
  }
}

/**
 * خواندن سفارش در انتظار بدون پاک‌کردن آن.
 * صفحه تسویه از این تابع استفاده می‌کند تا بعد از بازگشت ناموفق از درگاه، همان
 * سفارش را دوباره پرداخت کند (سرور برای سفارش در وضعیت `PENDING_PAYMENT` همان
 * لینک پرداخت قبلی را برمی‌گرداند، پس سفارش تکراری ساخته نمی‌شود).
 */
export function peekPendingOrder(): PendingOrderReward | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPendingOrderReward(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** خواندن و پاک‌کردن سفارش در انتظار (یک‌بارمصرف). */
export function consumePendingOrder(): PendingOrderReward | null {
  const record = peekPendingOrder();
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // اگر storage پاک نشد، فقط یک رکورد بی‌اثر باقی می‌ماند.
  }
  return record;
}

/**
 * پاک‌کردن سفارش در انتظار بدون خواندن آن.
 *
 * صفحه تسویه وقتی سبد بعد از ساخت سفارش تغییر کرده باشد این را صدا می‌زند تا
 * رکورد بی‌اعتبار (سفارش با مبلغ/اقلام قدیمی) دوباره پرداخت نشود.
 */
export function forgetPendingOrder(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // نبود storage یعنی رکوردی هم برای پاک‌کردن نیست.
  }
}
