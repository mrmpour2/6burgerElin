import { CreditCard, ReceiptText, ShoppingBag, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Captcha } from "@/components/Captcha";
import { PageIntro } from "@/components/PageIntro";
import { Button, buttonVariants } from "@/components/ui/Button";
import { useCart } from "@/context/CartContext";
import { useLoyalty } from "@/context/LoyaltyContext";
import {
  createOrder,
  requestCheckoutOtp,
  verifyCheckoutOtp,
  readCheckoutOrder,
  cancelCheckoutOrder,
  errorCodeFrom,
  errorMessageFrom,
  fetchPaymentConfig,
  fileToDataUrl,
  requestZibalPayment,
  submitCardReceipt,
  type PaymentConfig,
  type PaymentMethod,
} from "@/api/orders";
import { formatPrice, pointsForAmount } from "@/data/content";
import { useLanguage } from "@/hooks/useLanguage";
import { forgetPendingOrder, peekPendingOrder, rememberPendingOrder } from "@/utils/orderReward";
import { isValidPhone, toLatinDigits } from "@/utils/phone";
import { getChatSessionId } from "@/utils/session";
import { cn } from "@/utils/cn";

/** بزرگ‌ترین تصویر رسیدی که سرور می‌پذیرد (سقف بدنه ۷ مگابایت است). */
const MAX_RECEIPT_BYTES = 7 * 1024 * 1024;

/** بعد از این تعداد کد اشتباه، بک‌اند کپچا می‌خواهد (`CAPTCHA_REQUIRED`). */
const OTP_FAILURES_BEFORE_CAPTCHA = 3;

/**
 * «اثر انگشت» سبد: کلید و تعداد هر سطر.
 *
 * سفارشی که ساخته می‌شود مبلغ و اقلام همان لحظه را قفل می‌کند؛ اگر مشتری بعد از
 * ساخت سفارش (مثلاً وقتی رسید کارت‌به‌کارت را نگرفته) چیزی به سبد اضافه یا کم
 * کند، باید سفارش تازه ساخته شود، وگرنه مبلغی که می‌بیند با سفارش ثبت‌شده فرق
 * می‌کند.
 */
function cartFingerprint(lines: { key: string; quantity: number }[]): string {
  return lines
    .map((line) => `${line.key}x${line.quantity}`)
    .sort()
    .join("|");
}

const inputClass =
  "h-14 w-full rounded-2xl border border-bun-line bg-bun-surface px-5 text-bun-text outline-none transition-colors placeholder:text-bun-muted focus:border-bun-orange focus:ring-2 focus:ring-bun-orange/20";

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-black text-bun-text">
        {label}
      </label>
      {children}
    </div>
  );
}

type MessageTone = "error" | "info" | "success";

interface CompletedOrder {
  orderNumber: string;
}

export default function CheckoutPage() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { lines, total, clear } = useCart();
  const { member } = useLoyalty();

  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [configFailed, setConfigFailed] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("zibal");
  const [name, setName] = useState(member?.name ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpFailures, setOtpFailures] = useState(0);
  const [captchaNeeded, setCaptchaNeeded] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [reservationExpiry, setReservationExpiry] = useState<string | null>(null);
  const [reservedCartKey, setReservedCartKey] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [orderKey, setOrderKey] = useState(() => {
    const existing = sessionStorage.getItem("checkout-idempotency");
    if (existing) return existing;
    const key = crypto.randomUUID(); sessionStorage.setItem("checkout-idempotency", key); return key;
  });
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: MessageTone; text: string } | null>(null);
  const [completed, setCompleted] = useState<CompletedOrder | null>(null);
  /** سفارشی که ساخته شده و منتظر رسید کارت‌به‌کارت است (تا سفارش تکراری نسازیم). */
  const [pendingOrder, setPendingOrder] = useState<{ id: string; orderNumber: string; total: number } | null>(null);

  useEffect(() => {
    let active = true;
    fetchPaymentConfig()
      .then((value) => {
        if (!active) return;
        setConfig(value);
        // اگر درگاه آنلاین خاموش باشد، کارت‌به‌کارت تنها گزینه است.
        if (!value.zibalEnabled && value.cardToCard.enabled) setMethod("card");
      })
      .catch(() => {
        if (active) setConfigFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // سفارش نیمه‌کاره‌ای که از درگاه برگشته: همان را دوباره پرداخت می‌کنیم — ولی
  // فقط اگر سبد همان سبد آن سفارش باشد؛ سبدِ عوض‌شده باید سفارش تازه بگیرد.
  useEffect(() => {
    const stored = peekPendingOrder();
    if (!stored) return;
    if (stored.cartKey && stored.cartKey !== cartFingerprint(lines)) setMessage({ tone: "info", text: t("checkout.staleOrder") });
    setReservedCartKey(stored.cartKey ?? null);
    setPhone(stored.phone);
    setPendingOrder({ id: stored.orderId, orderNumber: stored.orderNumber, total: stored.total });
    void readCheckoutOrder(stored.orderId).then(order => {
      setReservationExpiry(order.expiresAt);
      setVerifiedPhone(stored.phone);
      if (["CANCELLED", "REFUNDED"].includes(order.status)) {
        setPendingOrder(null); setReservationExpiry(null); setReservedCartKey(null); forgetPendingOrder();
        const key = crypto.randomUUID(); setOrderKey(key); sessionStorage.setItem("checkout-idempotency", key);
      }
    }).catch(() => setVerifiedPhone(""));
    // فقط یک‌بار در mount؛ تغییر سبد نباید پیام را دوباره بسازد.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitLabel = useMemo(() => {
    if (busy) return t("checkout.busy");
    if (method === "zibal") return t("checkout.submitZibal");
    return receipt ? t("checkout.submitReceipt") : t("checkout.submitCard");
  }, [busy, method, receipt, t]);

  const canSubmit =
    lines.length > 0 &&
    verifiedPhone === phone.trim() && Boolean(verifiedPhone) &&
    (!reservationExpiry || new Date(reservationExpiry).getTime() > clock) &&
    (!reservedCartKey || reservedCartKey === cartFingerprint(lines)) &&
    !busy &&
    config !== null &&
    (method === "zibal" ? config.zibalEnabled : config.cardToCard.enabled);

  /** توکن کپچا یک‌بارمصرف است؛ بعد از هر درخواست باید دوباره گرفته شود. */
  const resetCaptcha = () => {
    setCaptchaToken("");
    setCaptchaReset((n) => n + 1);
  };

  const resetOtpGuard = () => {
    setOtpFailures(0);
    setCaptchaNeeded(false);
    resetCaptcha();
  };

  const captchaMessage = () =>
    language === "fa"
      ? "برای ادامه کپچا را تکمیل کنید."
      : "Please complete the captcha to continue.";

  const handleSendOtp = async () => {
    if (captchaNeeded && !captchaToken) {
      setMessage({ tone: "error", text: captchaMessage() });
      return;
    }
    setBusy(true);
    try {
      setChallengeId(await requestCheckoutOtp(phone, captchaToken || undefined));
      setOtpCode("");
      resetOtpGuard();
      setMessage({ tone: "info", text: language === "fa" ? "کد تأیید ارسال شد." : "Verification code requested." });
    } catch (error) {
      if (errorCodeFrom(error) === "CAPTCHA_REQUIRED") {
        setCaptchaNeeded(true);
        setMessage({ tone: "error", text: captchaMessage() });
      } else {
        setMessage({ tone: "error", text: errorMessageFrom(error) });
      }
      resetCaptcha();
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (captchaNeeded && !captchaToken) {
      setMessage({ tone: "error", text: captchaMessage() });
      return;
    }
    setBusy(true);
    try {
      await verifyCheckoutOtp(phone, challengeId, otpCode, captchaNeeded ? captchaToken : undefined);
      setVerifiedPhone(phone.trim());
      setOtpCode("");
      setMessage(null);
      resetOtpGuard();
    } catch (error) {
      if (errorCodeFrom(error) === "CAPTCHA_REQUIRED") {
        // سرور کپچا خواسته (مثلاً بعد از رفرش صفحه که شمارنده محلی صفر شده).
        setCaptchaNeeded(true);
        setMessage({ tone: "error", text: captchaMessage() });
      } else {
        const failures = otpFailures + 1;
        setOtpFailures(failures);
        if (failures >= OTP_FAILURES_BEFORE_CAPTCHA) setCaptchaNeeded(true);
        setMessage({ tone: "error", text: errorMessageFrom(error) });
      }
      resetCaptcha();
    } finally {
      setBusy(false);
    }
  };

  const onReceiptChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file && file.size > MAX_RECEIPT_BYTES) {
      setReceipt(null);
      setMessage({ tone: "error", text: t("checkout.receiptHint") });
      return;
    }
    setReceipt(file);
    setMessage(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    if (name.trim().length < 2) {
      setMessage({ tone: "error", text: t("checkout.errorName") });
      return;
    }
    if (!isValidPhone(phone)) {
      setMessage({ tone: "error", text: t("checkout.errorPhone") });
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMessage({ tone: "error", text: t("checkout.errorEmail") });
      return;
    }
    if (address.trim().length < 5) {
      setMessage({ tone: "error", text: t("checkout.errorAddress") });
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      // سفارش فقط یک‌بار ساخته می‌شود؛ تلاش‌های بعدی همان سفارش را پرداخت می‌کنند.
      let order = pendingOrder;
      if (!order) {
        const lineByKey = new Map(lines.map((line) => [line.key, line]));
        if (verifiedPhone !== phone.trim()) throw new Error("Mobile verification is required.");
        const created = await createOrder({
          idempotencyKey: orderKey,
          sessionId: getChatSessionId(),
          customerName: name.trim(),
          customerPhone: phone.trim(),
          ...(email.trim() ? { customerEmail: email.trim() } : {}),
          shippingAddress: address.trim(),
          items: lines.flatMap((line) => {
            const variant = line.variantId ? { variantId: line.variantId } : null;
            if (!line.parentKey) return [{ productId: line.productId, ...variant, quantity: line.quantity }];

            // مخلفات بی‌قلم اصلی هرگز فرستاده نمی‌شود (سبد خودش این حالت را
            // نمی‌سازد؛ این فقط یک محافظ است).
            const parent = lineByKey.get(line.parentKey);
            if (!parent) return [];
            return [
              {
                productId: line.productId,
                ...variant,
                quantity: line.quantity,
                parent: {
                  productId: parent.productId,
                  ...(parent.variantId ? { variantId: parent.variantId } : null),
                },
              },
            ];
          }),
        });
        order = { id: created.id, orderNumber: created.orderNumber, total: created.totalAmount };
        setPendingOrder(order);
        setReservationExpiry(created.expiresAt);
        setReservedCartKey(cartFingerprint(lines));
        rememberPendingOrder({ orderId: order.id, orderNumber: order.orderNumber, total: order.total, phone: phone.trim(), createdAt: new Date().toISOString(), cartKey: cartFingerprint(lines) });
      }

      if (method === "zibal") {
        const paymentUrl = await requestZibalPayment(order.id);
        // نتیجه پرداخت روی صفحه اصلی برمی‌گردد (`?payment=success|failed`)، پس
        // مبلغ و شماره تماس را ذخیره می‌کنیم تا امتیاز باشگاه گم نشود.
        rememberPendingOrder({
          orderId: order.id,
          orderNumber: order.orderNumber,
          total: order.total,
          phone: phone.trim(),
          createdAt: new Date().toISOString(),
          cartKey: cartFingerprint(lines),
        });
        window.location.assign(paymentUrl);
        return;
      }

      // کارت‌به‌کارت: اول سفارش رزرو می‌شود، بعد مشتری واریز و ارسال رسید را کامل می‌کند.
      if (!receipt) {
        setMessage({
          tone: "info",
          text: t("checkout.cardCreated", { orderNumber: order.orderNumber }),
        });
        return;
      }

      const imageData = await fileToDataUrl(receipt);
      await submitCardReceipt(order.id, imageData, reference);
      // امتیاز باشگاه پس از تأیید رسید و تبدیل سفارش به `PAID` در بک‌اند ثبت
      // می‌شود؛ این‌جا هیچ امتیازی به حساب اضافه نمی‌کنیم.
      setCompleted({ orderNumber: order.orderNumber });
      setPendingOrder(null);
      setReceipt(null);
      setReference("");
      forgetPendingOrder();
      const freshKey = crypto.randomUUID(); setOrderKey(freshKey); sessionStorage.setItem("checkout-idempotency", freshKey);
      clear();
    } catch (error) {
      setMessage({ tone: "error", text: errorMessageFrom(error, t("checkout.errorGeneric")) });
    } finally {
      setBusy(false);
    }
  };

  if (completed) {
    return (
      <>
        <PageIntro
          kicker={t("checkout.kicker")}
          title={t("checkout.successTitle")}
          description={t("checkout.successText", { orderNumber: completed.orderNumber })}
        />
        <section className="bg-bun-paper py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <div>
              <Link to="/menu" className={buttonVariants({ size: "lg", className: "mt-8" })}>
                {t("checkout.backToMenu")}
              </Link>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageIntro
        kicker={t("checkout.kicker")}
        title={t("checkout.title")}
        description={t("checkout.description")}
      />

      <section className="bg-bun-paper py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {lines.length === 0 ? (
            <div className="mx-auto max-w-xl rounded-[1.75rem] border border-bun-line bg-bun-surface px-8 py-14 text-center">
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-bun-paper text-bun-muted">
                <ShoppingBag className="size-7" aria-hidden="true" />
              </span>
              <p className="mt-5 font-black text-bun-text">{t("checkout.empty")}</p>
              <Link to="/menu" className={buttonVariants({ className: "mt-6" })}>
                {t("cart.browseMenu")}
              </Link>
            </div>
          ) : (
            <div className="grid gap-12 lg:grid-cols-[1.15fr_1fr]">
              <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                <div className="rounded-[1.75rem] border border-bun-line bg-bun-surface/60 p-6 sm:p-8">
                  <h2 className="font-display text-xl font-black text-bun-text">
                    {t("checkout.contact")}
                  </h2>
                  <div className="mt-6 space-y-5">
                    <Field id="checkout-name" label={t("checkout.name")}>
                      <input
                        id="checkout-name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        autoComplete="name"
                        placeholder={t("checkout.namePlaceholder")}
                        className={inputClass}
                      />
                    </Field>
                    <Field id="checkout-phone" label={t("checkout.phone")}>
                      <input
                        id="checkout-phone"
                        disabled={Boolean(pendingOrder)}
                        value={phone}
                        onChange={(event) => { setPhone(event.target.value); setVerifiedPhone(""); setChallengeId(""); setOtpCode(""); resetOtpGuard(); setPendingOrder(null); setOrderKey(crypto.randomUUID()); }}
                        type="tel"
                        inputMode="tel"
                        dir="ltr"
                        autoComplete="tel"
                        placeholder={t("checkout.phonePlaceholder")}
                        className={inputClass}
                      />
                    </Field>
                    <div className="space-y-3" aria-label="Mobile verification">
                      <Button type="button" disabled={busy || verifiedPhone === phone.trim() || (captchaNeeded && !captchaToken)} onClick={() => void handleSendOtp()}>
                        {language === "fa" ? "ارسال کد تأیید موبایل" : "Send verification code"}
                      </Button>
                      {challengeId && verifiedPhone !== phone.trim() ? <>
                        <input className={inputClass} aria-label={language === "fa" ? "کد تأیید" : "Verification code"} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otpCode} onChange={e => setOtpCode(toLatinDigits(e.target.value).replace(/[^0-9]/g, ""))} />
                        <Button type="button" disabled={busy || otpCode.trim().length !== 6 || (captchaNeeded && !captchaToken)} onClick={() => void handleVerifyOtp()}>
                          {language === "fa" ? "تأیید شماره" : "Verify phone"}
                        </Button>
                      </> : null}
                      {captchaNeeded && verifiedPhone !== phone.trim() ? (
                        <div className="space-y-2">
                          <p role="alert" className="text-xs font-bold text-bun-muted">
                            {language === "fa"
                              ? "به‌دلیل چند تلاش ناموفق، لطفاً کپچا را تکمیل کنید."
                              : "Too many failed attempts. Please complete the captcha."}
                          </p>
                          <Captcha onToken={setCaptchaToken} resetKey={captchaReset} />
                        </div>
                      ) : null}
                      {verifiedPhone === phone.trim() && verifiedPhone ? <p role="status">{language === "fa" ? "موبایل تأیید شد." : "Phone verified."}</p> : null}
                      {reservationExpiry ? <p role="status">{language === "fa" ? "رزرو تا " : "Reserved until "}{new Date(reservationExpiry).toLocaleTimeString(language === "fa" ? "fa-IR" : "en-US", { hour: "2-digit", minute: "2-digit" })} · {Math.floor(Math.max(0, new Date(reservationExpiry).getTime() - clock) / 60000)}:{String(Math.floor(Math.max(0, new Date(reservationExpiry).getTime() - clock) / 1000) % 60).padStart(2, "0")}</p> : null}
                      {pendingOrder ? <Button type="button" disabled={busy} onClick={async () => {
                        setBusy(true); try { await cancelCheckoutOrder(pendingOrder.id); setPendingOrder(null); setReservationExpiry(null); setReservedCartKey(null); forgetPendingOrder(); const key = crypto.randomUUID(); setOrderKey(key); sessionStorage.setItem("checkout-idempotency", key); }
                        catch(error) { setMessage({ tone: "error", text: errorMessageFrom(error) }); } finally { setBusy(false); }
                      }}>{language === "fa" ? "لغو رزرو و شروع دوباره" : "Cancel reservation and start again"}</Button> : null}
                    </div>
                    <Field id="checkout-email" label={t("checkout.email")}>
                      <input
                        id="checkout-email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        type="email"
                        dir="ltr"
                        autoComplete="email"
                        placeholder={t("checkout.emailPlaceholder")}
                        className={inputClass}
                      />
                    </Field>
                    <Field id="checkout-address" label={t("checkout.address")}>
                      <textarea
                        id="checkout-address"
                        value={address}
                        onChange={(event) => setAddress(event.target.value)}
                        rows={3}
                        autoComplete="street-address"
                        placeholder={t("checkout.addressPlaceholder")}
                        className={cn(inputClass, "h-auto resize-y py-4 leading-7")}
                      />
                    </Field>
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-bun-line bg-bun-surface/60 p-6 sm:p-8">
                  <h2 className="font-display text-xl font-black text-bun-text">
                    {t("checkout.payment")}
                  </h2>

                  {configFailed ? (
                    <p
                      role="status"
                      className="mt-5 rounded-2xl border border-bun-line bg-bun-paper px-4 py-3 text-sm font-bold text-bun-muted"
                    >
                      {t("checkout.configError")}
                    </p>
                  ) : config === null ? (
                    <p className="mt-5 text-sm font-bold text-bun-muted">{t("common.loading")}</p>
                  ) : !config.zibalEnabled && !config.cardToCard.enabled ? (
                    <p
                      role="status"
                      className="mt-5 rounded-2xl border border-bun-line bg-bun-paper px-4 py-3 text-sm font-bold text-bun-muted"
                    >
                      {t("checkout.noMethod")}
                    </p>
                  ) : (
                    <div className="mt-5 space-y-5">
                      <div className="flex flex-wrap gap-3">
                        {config.zibalEnabled ? (
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-full border px-5 py-3 text-sm font-bold transition-colors",
                              method === "zibal"
                                ? "border-bun-orange bg-bun-orange/10 text-bun-accent"
                                : "border-bun-line bg-bun-paper text-bun-muted hover:text-bun-text",
                            )}
                          >
                            <input
                              type="radio"
                              name="payment-method"
                              value="zibal"
                              checked={method === "zibal"}
                              onChange={() => setMethod("zibal")}
                              className="accent-bun-orange"
                            />
                            {t("checkout.zibal")}
                          </label>
                        ) : null}
                        {config.cardToCard.enabled ? (
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-full border px-5 py-3 text-sm font-bold transition-colors",
                              method === "card"
                                ? "border-bun-orange bg-bun-orange/10 text-bun-accent"
                                : "border-bun-line bg-bun-paper text-bun-muted hover:text-bun-text",
                            )}
                          >
                            <input
                              type="radio"
                              name="payment-method"
                              value="card"
                              checked={method === "card"}
                              onChange={() => setMethod("card")}
                              className="accent-bun-orange"
                            />
                            {t("checkout.card")}
                          </label>
                        ) : null}
                      </div>

                      {method === "card" && config.cardToCard.enabled ? (
                        <div className="space-y-4 rounded-2xl border border-dashed border-bun-line bg-bun-paper p-5">
                          <p className="flex items-center gap-2 text-sm font-black text-bun-text">
                            <CreditCard className="size-4 text-bun-orange" aria-hidden="true" />
                            {t("checkout.card")}
                          </p>
                          <dl className="space-y-2 text-sm">
                            {config.cardToCard.cardNumber ? (
                              <div className="flex items-center justify-between gap-3">
                                <dt className="text-bun-muted">{t("checkout.cardNumber")}</dt>
                                <dd dir="ltr" className="font-black tracking-wider text-bun-text">
                                  {config.cardToCard.cardNumber}
                                </dd>
                              </div>
                            ) : null}
                            {config.cardToCard.ownerName ? (
                              <div className="flex items-center justify-between gap-3">
                                <dt className="text-bun-muted">{t("checkout.cardOwner")}</dt>
                                <dd className="font-black text-bun-text">{config.cardToCard.ownerName}</dd>
                              </div>
                            ) : null}
                            {config.cardToCard.bankName ? (
                              <div className="flex items-center justify-between gap-3">
                                <dt className="text-bun-muted">{t("checkout.cardBank")}</dt>
                                <dd className="font-black text-bun-text">{config.cardToCard.bankName}</dd>
                              </div>
                            ) : null}
                          </dl>

                          <div className="space-y-2">
                            <label
                              htmlFor="checkout-receipt"
                              className="flex cursor-pointer items-center gap-3 rounded-2xl border border-bun-line bg-bun-surface px-4 py-3 outline-none transition-colors hover:border-bun-orange focus-within:ring-2 focus-within:ring-bun-orange/20"
                            >
                              <UploadCloud className="size-4 text-bun-orange" aria-hidden="true" />
                              <span className="text-sm font-bold text-bun-text">
                                {t("checkout.receipt")}
                              </span>
                              <input
                                id="checkout-receipt"
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={onReceiptChange}
                                className="sr-only"
                              />
                            </label>
                            <p className="text-xs text-bun-muted">{t("checkout.receiptHint")}</p>
                            {receipt ? (
                              <p className="flex items-center gap-2 text-xs font-black text-bun-accent">
                                <ReceiptText className="size-3.5" aria-hidden="true" />
                                {receipt.name}
                              </p>
                            ) : null}
                          </div>

                          <Field id="checkout-reference" label={t("checkout.reference")}>
                            <input
                              id="checkout-reference"
                              value={reference}
                              onChange={(event) => setReference(event.target.value)}
                              dir="ltr"
                              className={inputClass}
                            />
                          </Field>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {message ? (
                    <p
                      role="status"
                      className={cn(
                        "mt-5 rounded-2xl px-4 py-3 text-sm font-bold",
                        message.tone === "error"
                          ? "bg-bun-red/10 text-bun-red"
                          : message.tone === "success"
                            ? "bg-bun-orange/12 text-bun-accent"
                            : "bg-bun-paper text-bun-muted",
                      )}
                    >
                      {message.text}
                    </p>
                  ) : null}

                  <Button type="submit" size="lg" disabled={!canSubmit} className="mt-6 w-full">
                    {submitLabel}
                  </Button>
                </div>

              </form>

              <aside className="lg:sticky lg:top-28 lg:self-start">
                <div className="rounded-[1.75rem] border border-bun-line bg-bun-surface p-6">
                  <h2 className="font-display text-xl font-black text-bun-text">
                    {t("checkout.summary")}
                  </h2>
                  <ul className="mt-5 space-y-3">
                    {lines
                      .filter((line) => !line.parentKey)
                      .map((line) => (
                        <li key={line.key} className="space-y-3">
                          <ul className="space-y-3">
                            <li className="flex items-start justify-between gap-4 text-sm">
                              <span className="min-w-0 flex-1 font-bold text-bun-text">
                                <span className="text-bun-muted">{line.quantity}× </span>
                                {line.name[language]}
                                {line.variantLabel ? (
                                  <span className="mt-0.5 block text-xs font-bold text-bun-accent">
                                    {line.variantLabel[language]}
                                  </span>
                                ) : null}
                              </span>
                              <span className="shrink-0 font-black text-bun-text">
                                {formatPrice(line.price * line.quantity, language)}
                              </span>
                            </li>
                            {/* مخلفات همین غذا، تورفته و با برچسب روشن. */}
                            {lines
                              .filter((candidate) => candidate.parentKey === line.key)
                              .map((addOn) => (
                                <li
                                  key={addOn.key}
                                  className="ms-4 flex items-start justify-between gap-4 text-sm"
                                >
                                  <span className="min-w-0 flex-1 font-bold text-bun-text">
                                    <span className="text-bun-muted">{addOn.quantity}× </span>
                                    {addOn.name[language]}
                                    <span className="mt-0.5 block text-[0.65rem] font-black uppercase tracking-[0.2em] text-bun-muted">
                                      {t("addOns.cartLabel")}
                                    </span>
                                  </span>
                                  <span className="shrink-0 font-black text-bun-text">
                                    {formatPrice(addOn.price * addOn.quantity, language)}
                                  </span>
                                </li>
                              ))}
                          </ul>
                        </li>
                      ))}
                  </ul>
                  <div className="mt-6 flex items-center justify-between border-t border-bun-line pt-5">
                    <span className="text-sm font-bold text-bun-muted">{t("checkout.total")}</span>
                    <span className="font-display text-2xl font-black text-bun-text">
                      {formatPrice(total, language)}
                    </span>
                  </div>
                  {pointsForAmount(total) > 0 ? (
                    <p className="mt-3 text-xs font-bold text-bun-accent">
                      +{pointsForAmount(total)} {t("loyalty.pointsLabel")}
                    </p>
                  ) : null}
                  {method === "card" && pendingOrder ? (
                    <p className="mt-3 rounded-2xl bg-bun-paper px-4 py-3 text-xs font-bold leading-5 text-bun-muted">
                      {t("checkout.cardCreated", { orderNumber: pendingOrder.orderNumber })}
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs leading-5 text-bun-muted">{t("checkout.stockNote")}</p>
                </div>
              </aside>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

