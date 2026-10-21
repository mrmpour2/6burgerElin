import { BadgeCheck, Clock, Quote } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ReviewStars } from "@/components/ReviewStars";
import { useLanguage } from "@/hooks/useLanguage";
import type { ProductReview } from "@/types";
import { cn } from "@/utils/cn";
import { formatReviewDate, formatReviewNumber, safeReviewImage } from "@/utils/reviews";

interface ReviewCardProps {
  review: ProductReview;
  className?: string;
}

/**
 * تصویر پیوست نظر.
 *
 * دو لایه محافظت دارد: `safeReviewImage` نشانی ناامن (`javascript:`, `data:`,
 * `http://`) را رد می‌کند و اگر تصویر لود نشد، خودش را از صفحه برمی‌دارد تا
 * آیکن شکستهٔ مرورگر روی کارت نماند.
 */
function ReviewPhoto({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const safeSrc = safeReviewImage(src);
  if (!safeSrc || failed) return null;

  return (
    <img
      src={safeSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="aspect-square w-full rounded-2xl border border-bun-line object-cover"
    />
  );
}

/**
 * کارت یک نظر مهمان.
 *
 * متن نظر فقط به‌صورت متن ساده رندر می‌شود (بدون `dangerouslySetInnerHTML`)، پس
 * حتی اگر API متنی با تگ HTML برگرداند، React آن را escape می‌کند.
 */
export function ReviewCard({ review, className }: ReviewCardProps) {
  const { t } = useTranslation();
  const language = useLanguage();

  const name = review.authorName.trim() || t("reviews.anonymous");
  const initial = Array.from(name)[0] ?? "?";
  const date = formatReviewDate(review.createdAt, language);
  const ratingText = formatReviewNumber(review.rating, language);

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-3xl border border-bun-line bg-bun-paper p-5 transition-shadow duration-200 hover:shadow-lg hover:shadow-bun-text/5 sm:p-6",
        className,
      )}
    >
      <header className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-bun-surface text-sm font-black text-bun-accent"
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-sm font-black text-bun-text">{name}</p>
            {review.orderVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-bun-accent/10 px-2 py-0.5 text-[11px] font-bold text-bun-accent">
                <BadgeCheck className="size-3.5" aria-hidden="true" />
                {t("reviews.verified")}
              </span>
            ) : null}
            {review.status === "pending" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-bun-gold/20 px-2 py-0.5 text-[11px] font-bold text-bun-text">
                <Clock className="size-3.5" aria-hidden="true" />
                {t("reviews.pending")}
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <ReviewStars
              rating={review.rating}
              size="sm"
              label={t("reviews.starsAria", { rating: ratingText })}
            />
            {date ? (
              <time dateTime={review.createdAt} className="text-xs text-bun-muted">
                {date}
              </time>
            ) : null}
          </div>
        </div>
      </header>

      <p className="mt-4 whitespace-pre-line text-sm leading-7 text-bun-text">{review.body}</p>

      {review.images.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {review.images.map((image) => (
            <ReviewPhoto key={image} src={image} alt={t("reviews.imageAlt", { name })} />
          ))}
        </div>
      ) : null}

      {review.reply ? (
        <div className="mt-auto pt-4">
          <div className="rounded-2xl border border-bun-line bg-bun-surface/70 p-4">
            <p className="inline-flex items-center gap-2 text-xs font-black text-bun-accent">
              <Quote className="size-3.5" aria-hidden="true" />
              {t("reviews.replyLabel")}
            </p>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-bun-text/85">
              {review.reply.body}
            </p>
          </div>
        </div>
      ) : null}
    </article>
  );
}
