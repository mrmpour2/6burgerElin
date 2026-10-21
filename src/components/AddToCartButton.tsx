import { Check, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { useAddOnPanel } from "@/context/AddOnContext";
import { isOrderableItem, resolveCartLineKey, useCart } from "@/context/CartContext";
import type { MenuItem, MenuItemVariant } from "@/types";
import { cn } from "@/utils/cn";

interface AddToCartButtonProps {
  item: MenuItem;
  /**
   * سایز/واریانت انتخاب‌شده در صفحه محصول. خالی باشد، واریانت پیش‌فرض
   * (`defaultVariant`) به سبد می‌رود تا دکمه کارت منو هم درست عمل کند.
   */
  selectedVariant?: MenuItemVariant | null;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  /** متن دکمه پیش از افزودن؛ پیش‌فرض `cart.add`. */
  label?: string;
  /**
   * وقتی آیتم قابل سفارش آنلاین نیست، به‌جای دکمه یک راهنمای کوتاه نشان داده
   * می‌شود. در کارت منو این راهنما لازم نیست، پس آن‌جا خاموش می‌شود.
   */
  showUnavailableHint?: boolean;
  /** مقدار `data-magnetic` (قدرت جذب نشانگر). برای حفظ قرارداد موشن صفحه محصول. */
  magnetic?: number;
}

/**
 * دکمه افزودن به سبد.
 *
 * آیتم‌های ثابت کاتالوگ شناسه محصول دیتابیس ندارند، پس سفارش آنلاین برای آن‌ها
 * ممکن نیست (`POST /api/payment/orders` وجود محصول را بررسی می‌کند). در آن حالت
 * دکمه به یک راهنما تبدیل می‌شود تا کاربر بیهوده تلاش نکند.
 *
 * اگر غذا مخلفات پیشنهادی داشته باشد (`MenuItem.addOnCount`)، بعد از افزودن
 * موفق پنل «تکمیل سفارش» باز می‌شود. این پیشنهاد برای هر سطر سبد فقط یک‌بار
 * می‌آید (`AddOnPanelProvider`)، پس زیاد‌کردن تعداد همان غذا پنل را تکرار نمی‌کند.
 */
export function AddToCartButton({
  item,
  selectedVariant,
  size = "md",
  variant = "primary",
  className,
  label,
  showUnavailableHint = true,
  magnetic,
}: AddToCartButtonProps) {
  const { t } = useTranslation();
  const { addItem } = useCart();
  const { offer } = useAddOnPanel();
  const [added, setAdded] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const handleClick = useCallback(() => {
    if (!addItem(item, 1, selectedVariant?.key)) return;
    setAdded(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAdded(false), 1800);

    // پیشنهاد مخلفات فقط وقتی غذا واقعاً چنین پیشنهادی دارد؛ کلید سطر با همان
    // قاعده‌ای ساخته می‌شود که `addItem` استفاده می‌کند تا پنل به سطر درست وصل شود.
    if (!item.addOnCount) return;
    const lineKey = resolveCartLineKey(item, selectedVariant?.key);
    if (!lineKey) return;
    offer({ lineKey, itemId: item.id, name: item.name });
  }, [addItem, item, offer, selectedVariant]);

  const variantSoldOut = selectedVariant?.available === false;

  if (!isOrderableItem(item) || variantSoldOut) {
    if (!showUnavailableHint) return null;
    return (
      <span className={cn("text-xs font-bold leading-5 text-bun-muted", className)}>
        {variantSoldOut ? t("menuPage.unavailable") : t("product.notOrderable")}
      </span>
    );
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={handleClick}
      className={className}
      {...(magnetic !== undefined ? { "data-magnetic": magnetic } : null)}
    >
      {added ? (
        <Check className="size-4" aria-hidden="true" />
      ) : (
        <Plus className="size-4" aria-hidden="true" />
      )}
      <span aria-live="polite">{added ? t("cart.added") : (label ?? t("cart.add"))}</span>
    </Button>
  );
}
