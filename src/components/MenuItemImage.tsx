import { UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ResponsiveImage } from "@/components/ResponsiveImage";
import { useLanguage } from "@/hooks/useLanguage";
import type { MenuItem } from "@/types";
import { cn } from "@/utils/cn";

interface MenuItemImageProps {
  item: MenuItem;
  /** همان `sizes` تصویر واکنش‌گرا؛ برای پلیس‌هولدر لازم نیست. */
  sizes?: string;
  eager?: boolean;
  className?: string;
  imageClassName?: string;
  /** انتقال `data-image-reveal` برای موتور انیمیشن (پیش‌فرض: روشن). */
  reveal?: boolean;
}

/**
 * تصویر آیتم منو با پشتیبان طراحي‌شده.
 *
 * آیتم‌های دیتابیس پنل هنوز `imageUrl` ندارند؛ به‌جای تصویر شکسته یا آدرس
 * تأییدنشده، یک پلاک گرادیانی با نام دسته نشان داده می‌شود. به‌محض اینکه ادمین
 * تصویر آپلود کند، همان `ResponsiveImage` (با `data-image-reveal`) نمایش می‌یابد
 * تا موتور انیمیشن مثل قبل کار کند.
 */
export function MenuItemImage({
  item,
  sizes,
  eager,
  className,
  imageClassName,
  reveal = true,
}: MenuItemImageProps) {
  const { t } = useTranslation();
  const language = useLanguage();
  /** اگر آدرس تصویر موجود باشد ولی لود نشود (۴۰۴ یا مسدودشده)، پلاک جای آن می‌آید. */
  const [failed, setFailed] = useState(false);

  if (item.image && !failed) {
    return (
      <ResponsiveImage
        src={item.image}
        alt={item.imageAlt[language]}
        sizes={sizes}
        eager={eager}
        className={className}
        imageClassName={imageClassName}
        reveal={reveal}
        onError={() => setFailed(true)}
      />
    );
  }

  // پلاک پشتیبان هم قرارداد موشن تصویر را رعایت می‌کند؛ اگر تصویر لود نشود یا
  // آیتم اصلاً تصویر نداشته باشد، انیمیشن reveal صفحه از دست نمی‌رود.
  return (
    <div
      role="img"
      aria-label={item.imageAlt[language]}
      {...(reveal ? { "data-image-reveal": "" } : null)}
      className={cn(
        "grid place-items-center overflow-hidden bg-gradient-to-br from-bun-ink via-bun-burgundy to-bun-red",
        className,
      )}
    >
      <span
        className={cn(
          "flex flex-col items-center gap-2 px-6 text-center text-white/90",
          imageClassName,
        )}
      >
        <UtensilsCrossed className="size-8" aria-hidden="true" />
        <span className="text-xs font-black uppercase tracking-[0.35em]">
          {t(`menuPage.categories.${item.category}`)}
        </span>
      </span>
    </div>
  );
}
