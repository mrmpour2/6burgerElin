import { AlertCircle, CheckCircle2, Clock, Loader2, Send, Star } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { errorMessageFrom } from "@/api/orders";
import type { SubmittedReview } from "@/api/reviews";
import { Button } from "@/components/ui/Button";
import { useLoyalty } from "@/context/LoyaltyContext";
import { useLanguage } from "@/hooks/useLanguage";
import type { ReviewFormValues } from "@/hooks/useProductReviews";
import type { StarRating } from "@/types";
import { cn } from "@/utils/cn";
import { POINTS_PER_REVIEW } from "@/utils/loyalty";
import {
  REVIEW_MAX_BODY_LENGTH,
  REVIEW_MAX_NAME_LENGTH,
  REVIEW_MIN_BODY_LENGTH,
  formatReviewNumber,
  hasReviewErrors,
  toPlainText,
  validateReviewDraft,
  type ReviewDraft,
  type ReviewField,
  type ReviewFieldError,
  type ReviewFieldErrors,
} from "@/utils/reviews";

interface ReviewFormProps {
  /** ثبت نظر؛ خطای پرتاب‌شدهٔ سرور همین‌جا نمایش داده می‌شود. */
  onSubmit: (values: ReviewFormValues) => Promise<SubmittedReview>;
  /** حالت آزمایشی: به کاربر بگو نظر تا رفرش صفحه دوام نمی‌آورد. */
  demoOnly?: boolean;
  className?: string;
}

/** ستاره‌های فرم به ترتیب طبیعی؛ جهت صفحه (RTL/LTR) جای ۱ و ۵ را تعیین می‌کند. */
const STARS: readonly StarRating[] = [1, 2, 3, 4, 5];

/** ترتیب فیلدها برای انتقال فوکوس به اولین خطا. */
const FIELD_ORDER: readonly ReviewField[] = ["rating", "name", "phone", "body", "orderNumber"];

/**
 * کلید ترجمهٔ هر کد خطا.
 *
 * کد خطا در `utils/reviews.ts` ساخته می‌شود و متن ترجمه اینجاست؛ همین جداسازی
 * باعث می‌شود منطق اعتبارسنجی به زبان رابط کاربری گره نخورد و متن خطا دوزبانه
 * بماند. `satisfies` تضمین می‌کند اگر کد خطای تازه‌ای اضافه شد، اینجا جا نماند.
 */
const FIELD_ERROR_KEYS = {
  ratingRequired: "reviews.form.errors.ratingRequired",
  nameRequired: "reviews.form.errors.nameRequired",
  nameTooLong: "reviews.form.errors.nameTooLong",
  phoneInvalid: "reviews.form.errors.phoneInvalid",
  bodyRequired: "reviews.form.errors.bodyRequired",
  bodyTooShort: "reviews.form.errors.bodyTooShort",
  bodyTooLong: "reviews.form.errors.bodyTooLong",
  orderNumberInvalid: "reviews.form.errors.orderNumberInvalid",
} as const satisfies Record<ReviewFieldError, string>;

const labelClass = "block text-xs font-bold text-bun-muted";

const inputClass =
  "mt-1.5 h-11 w-full rounded-2xl border border-bun-line bg-bun-surface/40 px-4 text-sm font-bold text-bun-text outline-none transition placeholder:font-normal placeholder:text-bun-muted focus-visible:border-bun-orange focus-visible:ring-2 focus-visible:ring-bun-orange/25";

const errorClass = "mt-1.5 flex items-start gap-1.5 text-xs font-bold text-bun-red";

/** پیام موفقیت؛ وضعیت «در انتظار تأیید» را شفاف اعلام می‌کند. */
function SuccessPanel({
  review,
  demoOnly,
  onReset,
}: {
  review: SubmittedReview;
  demoOnly: boolean;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const language = useLanguage();

  return (
    <div role="status" className="rounded-3xl border border-bun-line bg-bun-paper p-6 sm:p-8">
      <p className="inline-flex items-center gap-2 text-sm font-black text-bun-accent">
        <CheckCircle2 className="size-5" aria-hidden="true" />
        {t("reviews.form.successTitle")}
      </p>
      <p className="mt-3 text-sm leading-7 text-bun-muted">{t("reviews.form.successBody")}</p>
      {review.status === "pending" ? (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-bun-gold/20 px-3 py-1.5 text-xs font-bold text-bun-text">
          <Clock className="size-3.5" aria-hidden="true" />
          {t("reviews.form.successPending")}
        </p>
      ) : null}
      {demoOnly ? (
        <p className="mt-4 text-xs leading-6 text-bun-muted">{t("reviews.form.demoHint")}</p>
      ) : null}
      <div className="mt-6">
        <Button variant="secondary" onClick={onReset}>
          {t("reviews.form.writeAnother")}
        </Button>
      </div>
    </div>
  );
}

/**
 * فرم ثبت نظر مهمان.
 *
 * اعتبارسنجی سمت کلاینت با همان قواعدی است که سرور هم باید دوباره اجرا کند
 * (`utils/reviews.ts`) و متن خطا از کد خطا ساخته می‌شود. پرچم «خرید تأییدشده»
 * هرگز اینجا ست نمی‌شود؛ فقط سرور می‌تواند شمارهٔ سفارش را با سفارش واقعی تطبیق دهد.
 */
export function ReviewForm({ onSubmit, demoOnly = false, className }: ReviewFormProps) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { member } = useLoyalty();
  const formId = useId();
  const ratingLabelId = useId();
  const nameId = useId();
  const phoneId = useId();
  const bodyId = useId();
  const orderId = useId();
  const ratingErrorId = useId();
  const nameErrorId = useId();
  const phoneErrorId = useId();
  const bodyErrorId = useId();
  const orderErrorId = useId();

  const [rating, setRating] = useState<StarRating | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [body, setBody] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [errors, setErrors] = useState<ReviewFieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<SubmittedReview | null>(null);
  /** تا وقتی کاربر خودش شماره را دست نزده، شمارهٔ عضو باشگاه جای‌گذاری می‌شود. */
  const [phoneTouched, setPhoneTouched] = useState(false);

  const ratingRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const orderRef = useRef<HTMLInputElement>(null);

  // عضو باشگاه ممکن است بعد از باز شدن فرم وارد حساب شود؛ تا وقتی کاربر شماره را
  // دست نزده، مقدار پیشنهادی باشگاه را جای‌گذاری می‌کنیم.
  const memberPhone = member?.phone ?? "";
  useEffect(() => {
    if (!phoneTouched && memberPhone) setPhone(memberPhone);
  }, [memberPhone, phoneTouched]);

  /** فقط خطای همان فیلد پاک می‌شود تا پیام خطای بقیه نپرد. */
  const clearError = (field: ReviewField) => {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  /** فوکوس روی اولین فیلد خطادار تا کاربر کیبورد/صفحه‌خوان از خطا مطلع شود. */
  const focusField = (field: ReviewField) => {
    if (field === "rating") ratingRef.current?.focus();
    else if (field === "name") nameRef.current?.focus();
    else if (field === "phone") phoneRef.current?.focus();
    else if (field === "body") bodyRef.current?.focus();
    else orderRef.current?.focus();
  };

  /** کد خطا → متن ترجمه‌شده. */
  const errorText = (error: ReviewFieldError): string => {
    if (error === "bodyTooShort") {
      return t(FIELD_ERROR_KEYS[error], {
        min: formatReviewNumber(REVIEW_MIN_BODY_LENGTH, language),
      });
    }
    if (error === "bodyTooLong") {
      return t(FIELD_ERROR_KEYS[error], {
        max: formatReviewNumber(REVIEW_MAX_BODY_LENGTH, language),
      });
    }
    return t(FIELD_ERROR_KEYS[error]);
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const draft: ReviewDraft = { rating, name, phone, body, orderNumber };
    const nextErrors = validateReviewDraft(draft);
    setErrors(nextErrors);
    setServerError("");

    if (hasReviewErrors(nextErrors)) {
      const firstInvalid = FIELD_ORDER.find((field) => nextErrors[field]);
      if (firstInvalid) focusField(firstInvalid);
      return;
    }
    // اعتبارسنجی بالا انتخاب امتیاز را تضمین کرده است؛ این خط فقط نوع را باریک می‌کند.
    if (rating === null) return;

    setIsSubmitting(true);
    try {
      const result = await onSubmit({
        authorName: name,
        rating,
        body: toPlainText(body),
        orderNumber,
        phone,
      });
      setSubmitted(result);
      // امتیاز باشگاه را سرور فقط پس از تأیید همین نظر (و تطبیق شماره با عضو)
      // اضافه می‌کند؛ فرم هیچ امتیازی سمت مرورگر ثبت نمی‌کند.
      setRating(null);
      setName("");
      setBody("");
      setOrderNumber("");
      setErrors({});
    } catch (error) {
      setServerError(errorMessageFrom(error, t("reviews.form.errorBody")));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <SuccessPanel
        review={submitted}
        demoOnly={demoOnly}
        onReset={() => setSubmitted(null)}
      />
    );
  }

  return (
    <form
      id={formId}
      noValidate
      onSubmit={handleSubmit}
      className={cn("rounded-3xl border border-bun-line bg-bun-paper p-6 sm:p-8", className)}
    >
      <p className="section-kicker">{t("reviews.form.kicker")}</p>
      <h3 className="mt-2 font-display text-2xl font-black text-bun-text sm:text-3xl">
        {t("reviews.form.title")}
      </h3>
      <p className="mt-2 max-w-xl text-sm leading-7 text-bun-muted">{t("reviews.form.subtitle")}</p>

      <div className="mt-7 space-y-6">
        <div>
          <p id={ratingLabelId} className={labelClass}>
            {t("reviews.form.ratingLabel")} <span aria-hidden="true">*</span>
          </p>
          <div
            role="radiogroup"
            aria-labelledby={ratingLabelId}
            aria-required="true"
            {...(errors.rating ? { "aria-describedby": ratingErrorId } : null)}
            className="mt-2 inline-flex items-center gap-1"
          >
            {STARS.map((star) => (
              <label
                key={star}
                className="cursor-pointer rounded-full p-1 transition hover:scale-110"
              >
                <input
                  ref={star === 1 ? ratingRef : undefined}
                  type="radio"
                  name="rating"
                  value={star}
                  checked={rating === star}
                  onChange={() => {
                    setRating(star);
                    clearError("rating");
                  }}
                  className="peer sr-only"
                />
                <Star
                  aria-hidden="true"
                  className={cn(
                    "size-8 transition-colors duration-150",
                    rating !== null && star <= rating
                      ? "fill-bun-gold text-bun-gold"
                      : "fill-none text-bun-line peer-hover:text-bun-gold/70 peer-focus-visible:text-bun-gold",
                  )}
                />
                <span className="sr-only">
                  {t("reviews.form.ratingValue", { star: formatReviewNumber(star, language) })}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs leading-6 text-bun-muted">{t("reviews.form.ratingHint")}</p>
          {errors.rating ? (
            <p id={ratingErrorId} role="alert" className={errorClass}>
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {errorText(errors.rating)}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={nameId} className={labelClass}>
            {t("reviews.form.nameLabel")} <span aria-hidden="true">*</span>
          </label>
          <input
            ref={nameRef}
            id={nameId}
            type="text"
            value={name}
            maxLength={REVIEW_MAX_NAME_LENGTH}
            autoComplete="name"
            placeholder={t("reviews.form.namePlaceholder")}
            aria-required="true"
            {...(errors.name ? { "aria-invalid": true, "aria-describedby": nameErrorId } : null)}
            onChange={(event) => {
              setName(event.target.value);
              clearError("name");
            }}
            className={inputClass}
          />
          {errors.name ? (
            <p id={nameErrorId} role="alert" className={errorClass}>
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {errorText(errors.name)}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={phoneId} className={labelClass}>
            {t("reviews.form.phoneLabel")}
          </label>
          <input
            ref={phoneRef}
            id={phoneId}
            type="tel"
            dir="ltr"
            inputMode="tel"
            value={phone}
            maxLength={20}
            autoComplete="tel"
            placeholder={t("reviews.form.phonePlaceholder")}
            {...(errors.phone ? { "aria-invalid": true, "aria-describedby": phoneErrorId } : null)}
            onChange={(event) => {
              setPhoneTouched(true);
              setPhone(event.target.value);
              clearError("phone");
            }}
            className={cn(inputClass, "text-start font-mono tracking-wide")}
          />
          <p className="mt-1.5 text-xs leading-6 text-bun-muted">
            {member ? (
              t("reviews.form.phoneHintMember", {
                points: formatReviewNumber(POINTS_PER_REVIEW, language),
              })
            ) : (
              <>
                {t("reviews.form.phoneHintGuest", {
                  points: formatReviewNumber(POINTS_PER_REVIEW, language),
                })}{" "}
                <Link
                  to="/loyalty"
                  className="font-bold text-bun-accent underline-offset-4 hover:underline"
                >
                  {t("reviews.form.phoneHintGuestCta")}
                </Link>
              </>
            )}
          </p>
          {errors.phone ? (
            <p id={phoneErrorId} role="alert" className={errorClass}>
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {errorText(errors.phone)}
            </p>
          ) : null}
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor={bodyId} className={labelClass}>
              {t("reviews.form.bodyLabel")} <span aria-hidden="true">*</span>
            </label>
            <p className="text-xs text-bun-muted">
              {t("reviews.form.bodyCounter", {
                used: formatReviewNumber(body.length, language),
                max: formatReviewNumber(REVIEW_MAX_BODY_LENGTH, language),
              })}
            </p>
          </div>
          <textarea
            ref={bodyRef}
            id={bodyId}
            rows={5}
            value={body}
            maxLength={REVIEW_MAX_BODY_LENGTH}
            placeholder={t("reviews.form.bodyPlaceholder")}
            aria-required="true"
            {...(errors.body ? { "aria-invalid": true, "aria-describedby": bodyErrorId } : null)}
            onChange={(event) => {
              setBody(event.target.value);
              clearError("body");
            }}
            className={cn(inputClass, "h-auto resize-y py-3 leading-7")}
          />
          {errors.body ? (
            <p id={bodyErrorId} role="alert" className={errorClass}>
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {errorText(errors.body)}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={orderId} className={labelClass}>
            {t("reviews.form.orderLabel")}
          </label>
          <input
            ref={orderRef}
            id={orderId}
            type="text"
            dir="ltr"
            value={orderNumber}
            maxLength={40}
            autoComplete="off"
            placeholder="WEB-…-…"
            {...(errors.orderNumber
              ? { "aria-invalid": true, "aria-describedby": orderErrorId }
              : null)}
            onChange={(event) => {
              setOrderNumber(event.target.value);
              clearError("orderNumber");
            }}
            className={cn(inputClass, "text-start font-mono tracking-wide")}
          />
          <p className="mt-1.5 text-xs leading-6 text-bun-muted">{t("reviews.form.orderHint")}</p>
          {errors.orderNumber ? (
            <p id={orderErrorId} role="alert" className={errorClass}>
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {errorText(errors.orderNumber)}
            </p>
          ) : null}
        </div>
      </div>

      {serverError ? (
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-bun-red/40 bg-bun-red/5 p-4 text-bun-red"
        >
          <p className="flex items-center gap-2 text-sm font-black">
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            {t("reviews.form.errorTitle")}
          </p>
          <p className="mt-1.5 text-sm leading-6">{serverError}</p>
        </div>
      ) : null}

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
          {isSubmitting ? t("reviews.form.submitting") : t("reviews.form.submit")}
        </Button>
        <p className="text-xs text-bun-muted">{t("reviews.form.requiredNote")}</p>
      </div>

      {demoOnly ? (
        <p className="mt-4 text-xs leading-6 text-bun-muted">{t("reviews.form.demoHint")}</p>
      ) : null}
    </form>
  );
}
