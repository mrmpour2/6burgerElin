import { CircleCheck, TriangleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { paymentOutcomeFromUrl } from "@/api/orders";
import { useCart } from "@/context/CartContext";
import { consumePendingOrder } from "@/utils/orderReward";
import { cn } from "@/utils/cn";
import { useLanguage } from "@/hooks/useLanguage";

/**
 * نتیجه بازگشت از درگاه پرداخت.
 *
 * بک‌اند پس از تأیید زیبال به `${FRONTEND_URL}/?payment=success|failed` ریدایرکت
 * می‌کند (`zibalCallback`)، یعنی کاربر روی صفحه اصلی فرود می‌آید و آن لحظه هیچ
 * state زنده‌ای از سبد وجود ندارد. این بنر داخل `Layout` (همیشه mounted) قرار
 * دارد، پس روی هر مسیری که کاربر برگردد کار می‌کند و:
 *
 *   1. سفارش معلق را از storage می‌خواند و امتیاز باشگاه را ثبت می‌کند،
 *   2. سبد را خالی می‌کند چون اقلام همان سفارش پرداخت‌شده بودند،
 *   3. پارامتر آدرس را پاک می‌کند تا رفرش، پیام را تکرار نکند.
 */
export function PaymentOutcome() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { clear } = useCart();
  const [outcome, setOutcome] = useState<"success" | "failed" | "refund_pending" | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const result = paymentOutcomeFromUrl(window.location.search);
    if (!result) return;

    if (result === "success") {
      // سفارش معلق فقط برای پاک‌کردن سبد همان سفارش لازم است.
      consumePendingOrder();
      clear();
    }
    setOutcome(result);

    const url = new URL(window.location.href);
    url.searchParams.delete("payment");
    url.searchParams.delete("paymentId");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    // فقط یک‌بار در mount؛ `clear` عمداً در وابستگی‌ها نیست تا پاک‌کردن سبد
    // دوباره اجرا نشود.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!outcome || dismissed) return null;

  const success = outcome === "success";

  return (
    <div
      role="status"
      className={cn(
        "fixed inset-x-4 top-20 z-[80] mx-auto flex max-w-xl items-start gap-3 rounded-2xl border px-5 py-4 shadow-xl backdrop-blur-md",
        success
          ? "border-bun-orange/40 bg-bun-orange/12 text-bun-accent"
          : "border-bun-red/40 bg-bun-red/12 text-bun-red",
      )}
    >
      {success ? (
        <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      ) : (
        <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black">{outcome === "refund_pending" ? (language === "fa" ? "پرداخت تأیید شد؛ به‌دلیل نبود موجودی، بازپرداخت برای پیگیری ثبت شده است. پشتیبانی نتیجه را اطلاع می‌دهد." : "Payment verified. A refund and support case were recorded because stock was unavailable.") : t(success ? "payment.success" : "payment.failed")}</p>
        {success ? (
          <p className="mt-1 text-xs font-bold">{t("payment.pointsAuto")}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={t("payment.dismiss")}
        className="cursor-pointer rounded-full p-1 outline-none transition-colors hover:bg-current/10 focus-visible:ring-2 focus-visible:ring-bun-gold"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
