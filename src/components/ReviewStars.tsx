import { Star } from "lucide-react";
import { cn } from "@/utils/cn";

type StarSize = "sm" | "md" | "lg";

interface ReviewStarsProps {
  /** امتیاز؛ می‌تواند اعشاری باشد (میانگین) و به نزدیک‌ترین ستاره گرد می‌شود. */
  rating: number;
  size?: StarSize;
  /** اگر بدهی، ستاره‌ها تزئینی نیستند و با این متن برای صفحه‌خوان معرفی می‌شوند. */
  label?: string;
  className?: string;
}

const STAR_SIZES: Record<StarSize, string> = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-6",
};

/**
 * نمایش فقط-خواندنی امتیاز با پنج ستاره.
 *
 * خودِ ستاره‌ها `aria-hidden` هستند و مقدار امتیاز یک‌بار در `aria-label`
 * می‌آید، پس صفحه‌خوان «۳ از ۵» می‌خواند نه پنج ستارهٔ تکی.
 */
export function ReviewStars({ rating, size = "md", label, className }: ReviewStarsProps) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));

  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={cn(
            STAR_SIZES[size],
            star <= filled ? "fill-bun-gold text-bun-gold" : "fill-none text-bun-line",
          )}
        />
      ))}
    </span>
  );
}
