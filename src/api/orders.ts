import { apiClient } from "./client";

/**
 * لایه سفارش و پرداخت وب‌سایت مهمان.
 *
 * این ماژول همان مسیرهای عمومی را صدا می‌زند که دستیار گفتگو هم استفاده می‌کند
 * (`dashboard/backend/src/routes/paymentRoutes.js`) تا سبد خرید سایت و سبد
 * داخل گفتگو یک رفتار داشته باشند:
 *
 *   GET  /api/payment/config                     → پیکربندی درگاه‌ها
 *   POST /api/payment/orders                     → ساخت سفارش (و کاهش موجودی)
 *   POST /api/payment/zibal/request              → لینک پرداخت آنلاین
 *   POST /api/payment/card-to-card/submit        → ارسال تصویر رسید
 *
 * نکته مهم: `items[].productId` باید شناسه واقعی محصول در دیتابیس باشد؛
 * سرور وجود و فعال بودن محصول و کافی بودن موجودی را بررسی می‌کند.
 */

export interface CardToCardConfig {
  enabled: boolean;
  cardNumber: string | null;
  ownerName: string | null;
  bankName: string | null;
}

export interface PaymentConfig {
  storeName?: string;
  cardToCard: CardToCardConfig;
  zibalEnabled: boolean;
}

export type PaymentMethod = "zibal" | "card";

export interface OrderLineInput {
  productId: string;
  /**
   * سایز/واریانت انتخاب‌شده (مثل پیتزای تک‌نفره یا شش‌نفره). سرور قیمت همان
   * واریانت را از دیتابیس می‌خواند، پس قیمت سمت مرورگر مرجع نیست.
   */
  variantId?: string;
  quantity: number;
  /**
   * برای ردیف‌های مخلفات: اشاره به قلم اصلی همین سفارش (شناسه محصول + سایز).
   * سرور بررسی می‌کند که این محصول برای همان غذا در پنل تعریف شده باشد و پیوند
   * را در `chat_order_items.parentItemId` ذخیره می‌کند.
   */
  parent?: { productId: string; variantId?: string };
}

export interface CreateOrderInput {
  sessionId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  shippingAddress: string;
  items: OrderLineInput[];
}

export interface CreatedOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  currency: string;
}

/** پیکربندی پرداخت؛ سرور تعیین می‌کند کدام روش‌ها فعال‌اند. */
export async function fetchPaymentConfig(): Promise<PaymentConfig> {
  const { data } = await apiClient.get<PaymentConfig>("/payment/config");
  return data;
}

/** ساخت سفارش و رزرو موجودی. مبلغ نهایی را سرور از قیمت‌های دیتابیس می‌سازد. */
export async function createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  const { data } = await apiClient.post<{ order: CreatedOrder }>("/payment/orders", input);
  return data.order;
}

/** درخواست پرداخت آنلاین؛ آدرسی که مرورگر باید به آن برود. */
export async function requestZibalPayment(orderId: string): Promise<string> {
  const { data } = await apiClient.post<{ paymentUrl: string }>("/payment/zibal/request", { orderId });
  return data.paymentUrl;
}

/**
 * ارسال رسید کارت‌به‌کارت.
 *
 * تصویر به‌صورت data URL فرستاده می‌شود و سقف بدنه ۷ مگابایت است، پس مهلت
 * درخواست از ۱۰ ثانیه پیش‌فرض بیشتر گرفته می‌شود.
 */
export async function submitCardReceipt(
  orderId: string,
  imageData: string,
  transferReference?: string,
): Promise<string> {
  const reference = transferReference?.trim();
  const { data } = await apiClient.post<{ payment: { message: string } }>(
    "/payment/card-to-card/submit",
    { orderId, imageData, ...(reference ? { transferReference: reference } : {}) },
    { timeout: 45000 },
  );
  return data.payment.message;
}

/** تبدیل فایل رسید به data URL (همان قالب مورد انتظار سرور). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("receipt-unreadable"));
    reader.onerror = () => reject(new Error("receipt-unreadable"));
    reader.readAsDataURL(file);
  });
}

/**
 * نتیجه‌ای که درگاه پس از بازگشت در آدرس می‌گذارد.
 * بک‌اند به `${FRONTEND_URL}/?payment=success|failed` ریدایرکت می‌کند
 * (`zibalCallback`)، پس این پارامتر روی هر صفحه‌ای ممکن است دیده شود.
 */
export function paymentOutcomeFromUrl(search: string): "success" | "failed" | null {
  const outcome = new URLSearchParams(search).get("payment");
  return outcome === "success" || outcome === "failed" ? outcome : null;
}

/** پیام خطای سرور را استخراج می‌کند و در نبود آن، پیام پیش‌فرض را برمی‌گرداند. */
export function errorMessageFrom(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string; errors?: unknown } } }).response;
    const message = response?.data?.message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}
