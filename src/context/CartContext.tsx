import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { defaultVariant, findVariant, itemVariants } from "@/data/content";
import type { LocalizedText, MenuItem, MenuItemVariant } from "@/types";

/**
 * سبد خرید سراسری سایت.
 *
 * فقط محصولاتی که شناسه واقعی دیتابیس دارند (`MenuItem.productId`) قابل سفارش
 * آنلاین هستند، چون `POST /api/payment/orders` وجود و موجودی همان محصول را
 * بررسی می‌کند. آیتم‌های ثابت کاتالوگ (`src/data/content.ts`) چنین شناسه‌ای
 * ندارند، پس `isOrderableItem` برای آن‌ها `false` می‌دهد و رابط کاربری دکمه
 * افزودن را غیرفعال نشان می‌دهد.
 *
 * سبد در `localStorage` نگه داشته می‌شود تا رفتن به درگاه پرداخت و بازگشت از آن
 * (یا رفرش صفحه) سفارش مشتری را از بین نبرد.
 *
 * آیتم‌های دارای سایز/بسته (`MenuItem.variants`، مثل پیتزای تک‌نفره/دو‌نفره/
 * شش‌نفره) با **کلید مرکب** در سبد می‌نشینند (`cartLineKey`)، پس دو سایز از یک
 * پیتزا دو سطر جدا با دو قیمت جدا هستند و هر سطر `variantId` خودش را به سرور
 * می‌فرستد.
 *
 * مخلفات (نوشیدنی/ساید) سطرهایی هستند که `parentKey` دارند: کلید سطر غذای
 * اصلی‌شان. بنابراین «یک نوشابه برای برگر ۱» با «یک نوشابه برای برگر ۲» دو سطر
 * جداست، حذف غذا مخلفاتش را هم برمی‌دارد و سرور می‌تواند پیوند را در همان سفارش
 * ثبت کند.
 */

/** سقف‌های بک‌اند: حداکثر ۳۰ قلم در سفارش و حداکثر ۵۰ عدد از هر محصول. */
export const CART_MAX_LINES = 30;
export const CART_MAX_QUANTITY = 50;
/** سقف هر مخلفات برای یک قلم اصلی؛ هم‌اندازه با `MAX_ADD_ON_QUANTITY` سرور. */
export const CART_MAX_ADD_ON_QUANTITY = 10;

const STORAGE_KEY = "شیش برگر الین-cart-v1";

export interface CartLine {
  /**
   * کلید یکتای سطر سبد: برای آیتم ساده همان `productId`، برای آیتم دارای سایز
   * `productId::variantId` و برای مخلفات `addon:parentKey:productId`.
   * بنابراین دو سایز از یک پیتزا دو سطر جدا می‌گیرند.
   */
  key: string;
  /** شناسه محصول در دیتابیس؛ همان چیزی که به `POST /api/payment/orders` می‌رود. */
  productId: string;
  /** شناسه واریانت انتخاب‌شده در دیتابیس (فقط آیتم‌های دارای سایز/بسته). */
  variantId?: string;
  /** برچسب واریانت برای نمایش در سبد و خلاصه سفارش. */
  variantLabel?: LocalizedText;
  /**
   * کلید سطر غذای اصلی برای سطرهای مخلفات؛ `undefined` یعنی این سطر خودش یک
   * قلم مستقل است. مخلفاتِ بی‌والد هنگام خواندن از storage کنار گذاشته می‌شوند.
   */
  parentKey?: string;
  /** تعداد مخلفات پیشنهادی این آیتم؛ در کشو برای دکمه «افزودن مخلفات» لازم است. */
  addOnCount?: number;
  /** شناسه منو (slug یا cuid) برای لینک به صفحه محصول. */
  id: string;
  name: LocalizedText;
  price: number;
  image: string;
  quantity: number;
  /** `null` یعنی موجودی نامشخص؛ در آن حالت سقف عمومی اعمال می‌شود. */
  stock: number | null;
}

/** کلید یکتای سطر سبد؛ بدون واریانت همان شناسه محصول است. */
export function cartLineKey(productId: string, variantId?: string | null): string {
  return variantId ? `${productId}::${variantId}` : productId;
}

/**
 * کلید سطر مخلفات. `parentKey` بخشی از کلید است تا یک نوشیدنی برای دو غذای
 * مختلف دو سطر جدا بماند و سطر مخلفات با سطر مستقلِ همان محصول قاطی نشود.
 */
export function addOnLineKey(parentKey: string, productId: string): string {
  return `addon:${parentKey}:${productId}`;
}

interface CartContextValue {
  lines: CartLine[];
  /** مجموع تعداد اقلام (نه تعداد سطرها). */
  count: number;
  total: number;
  isOpen: boolean;
  /**
   * افزودن آیتم (و در صورت وجود، سایز/واریانت انتخاب‌شده) به سبد.
   * `false` یعنی آیتم قابل سفارش آنلاین نیست یا واریانت انتخاب‌شده موجود نیست.
   */
  addItem: (item: MenuItem, quantity?: number, variantKey?: string) => boolean;
  /**
   * ثبت/ویرایش مخلفات یک قلم اصلی. تعداد **مطلق** است (نه افزایشی): صفر یعنی
   * حذف همان مخلفات. بنابراین اجرای دوباره هرگز سطر تکراری نمی‌سازد.
   * `false` یعنی قلم اصلی در سبد نیست، مخلفات قابل سفارش نیست یا سبد پر است.
   */
  setAddOn: (parentLineKey: string, item: MenuItem, quantity: number) => boolean;
  /** تغییر تعداد یک سطر با `CartLine.key`. */
  setQuantity: (lineKey: string, quantity: number) => void;
  /** حذف یک سطر با `CartLine.key` (و مخلفات وابسته‌اش). */
  removeItem: (lineKey: string) => void;
  clear: () => void;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/** آیا این آیتم می‌تواند به سفارش آنلاین تبدیل شود؟ */
export function isOrderableItem(item: MenuItem): boolean {
  return Boolean(item.productId) && item.available !== false;
}

/**
 * کلید سطر سبدی که `addItem` برای این آیتم می‌سازد (با واریانت پیش‌فرض وقتی
 * کاربر سایزی انتخاب نکرده است). `null` یعنی آیتم قابل سفارش نیست.
 *
 * صفحه‌ها از همین تابع استفاده می‌کنند تا پس از افزودن، سطر تازه را پیدا کنند
 * (مثلاً برای پیشنهاد مخلفات) بدون آنکه منطق کلید در دو جا تکرار شود.
 */
export function resolveCartLineKey(item: MenuItem, variantKey?: string | null): string | null {
  if (!isOrderableItem(item) || !item.productId) return null;
  const variants = itemVariants(item);
  if (variants.length === 0) return cartLineKey(item.productId);

  const chosen = findVariant(item, variantKey) ?? defaultVariant(item);
  if (!chosen || chosen.available === false) return null;
  return cartLineKey(item.productId, chosen.id ?? chosen.key);
}

function isLocalizedText(value: unknown): value is LocalizedText {
  if (typeof value !== "object" || value === null) return false;
  const text = value as Record<string, unknown>;
  return typeof text.en === "string" && typeof text.fa === "string";
}

/** سطر ذخیره‌شده در `localStorage`؛ نسخه‌های قدیمی `key` نداشتند. */
type StoredCartLine = Omit<CartLine, "key"> & { key?: string };

function isCartLine(value: unknown): value is StoredCartLine {
  if (typeof value !== "object" || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.productId === "string" &&
    line.productId.length > 0 &&
    (line.key === undefined || typeof line.key === "string") &&
    (line.variantId === undefined || typeof line.variantId === "string") &&
    (line.variantLabel === undefined || isLocalizedText(line.variantLabel)) &&
    (line.parentKey === undefined || typeof line.parentKey === "string") &&
    (line.addOnCount === undefined ||
      (typeof line.addOnCount === "number" && Number.isInteger(line.addOnCount) && line.addOnCount >= 0)) &&
    typeof line.id === "string" &&
    typeof line.price === "number" &&
    Number.isFinite(line.price) &&
    typeof line.image === "string" &&
    typeof line.quantity === "number" &&
    Number.isInteger(line.quantity) &&
    line.quantity >= 1 &&
    line.quantity <= CART_MAX_QUANTITY &&
    (line.stock === null || typeof line.stock === "number") &&
    isLocalizedText(line.name)
  );
}

/**
 * خواندن سبد ذخیره‌شده؛ هر سطر نامعتبر کنار گذاشته می‌شود.
 * `key` سبدهای ذخیره‌شده با نسخه قبلی سایت (که این فیلد را نداشتند) بازسازی
 * می‌شود تا به‌روزرسانی، سبد کاربر را از بین نبرد.
 *
 * سطر مخلفات بدون قلم اصلی‌اش بی‌معنی است (نه قابل نمایش و نه قابل سفارش)، پس
 * همان‌جا کنار گذاشته می‌شود تا سبد هیچ‌وقت ناسازگار نشود.
 */
function readStoredLines(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const lines = parsed
      .filter(isCartLine)
      .slice(0, CART_MAX_LINES)
      .map((line) => ({ ...line, key: line.key ?? cartLineKey(line.productId, line.variantId) }));
    const keys = new Set(lines.filter((line) => !line.parentKey).map((line) => line.key));
    return lines.filter((line) => !line.parentKey || keys.has(line.parentKey));
  } catch {
    return [];
  }
}

/** سقف تعداد برای یک محصول: موجودی اعلام‌شده و سقف سرور، هر کدام کمتر بود. */
function quantityCap(stock: number | null, max = CART_MAX_QUANTITY): number {
  if (stock === null || !Number.isFinite(stock)) return max;
  return Math.max(0, Math.min(Math.floor(stock), max));
}

/** حذف یک سطر به‌همراه مخلفات وابسته‌اش (مخلفات بی‌قلم اصلی معنا ندارد). */
function withoutLine(current: CartLine[], lineKey: string): CartLine[] {
  return current.filter((line) => line.key !== lineKey && line.parentKey !== lineKey);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(readStoredLines);
  const [isOpen, setIsOpen] = useState(false);

  // سبد بین بازدیدها می‌ماند؛ نوشتن در storage هر تغییر را ذخیره می‌کند.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // storage پر/مسدود: سبد فقط در همین نشست زنده می‌ماند.
    }
  }, [lines]);

  const addItem = useCallback((item: MenuItem, quantity = 1, variantKey?: string) => {
    const productId = item.productId;
    if (!productId || !isOrderableItem(item)) return false;

    // سایز انتخاب‌شده (یا سایز پیش‌فرض) قیمت و موجودی همان سطر را تعیین می‌کند.
    const variants = itemVariants(item);
    let chosen: MenuItemVariant | null = null;
    if (variants.length > 0) {
      chosen = findVariant(item, variantKey) ?? defaultVariant(item);
      if (!chosen || chosen.available === false) return false;
    }

    const price = chosen?.price ?? item.price;
    const stock = chosen?.stock ?? item.stock ?? null;
    // واریانت‌های ثابت کاتالوگ شناسه دیتابیس ندارند؛ کلیدشان سطر را جدا نگه می‌دارد.
    const key = cartLineKey(productId, chosen?.id ?? chosen?.key);

    setLines((current) => {
      const cap = quantityCap(stock);
      if (cap < 1) return current;

      const existing = current.find((line) => line.key === key);
      if (existing) {
        // قیمت و موجودی تازه از منو می‌آید تا سبد با دیتابیس عقب نماند.
        return current.map((line) =>
          line.key === key
            ? { ...line, price, stock, quantity: Math.min(cap, line.quantity + quantity) }
            : line,
        );
      }
      if (current.length >= CART_MAX_LINES) return current;

      return [
        ...current,
        {
          key,
          productId,
          ...(chosen?.id ? { variantId: chosen.id } : null),
          ...(chosen ? { variantLabel: chosen.label } : null),
          ...(item.addOnCount ? { addOnCount: item.addOnCount } : null),
          id: item.id,
          name: item.name,
          price,
          image: item.image,
          quantity: Math.min(cap, Math.max(1, quantity)),
          stock,
        },
      ];
    });

    return true;
  }, []);

  /**
   * ثبت مخلفات برای یک قلم اصلی.
   *
   * تعداد مطلق است: صفر یعنی حذف همان مخلفات و عدد بزرگ‌تر یعنی «دقیقاً همین
   * تعداد». بنابراین پنل پیشنهاد می‌تواند هر بار وضعیت کامل را بفرستد و هیچ‌وقت
   * سطر تکراری ساخته نمی‌شود. سقف تعداد و موجودی همان‌جا اعمال می‌شود.
   */
  const setAddOn = useCallback((parentLineKey: string, item: MenuItem, quantity: number) => {
    const productId = item.productId;
    if (!productId || !isOrderableItem(item)) return false;

    const key = addOnLineKey(parentLineKey, productId);
    const cap = quantityCap(item.stock ?? null, CART_MAX_ADD_ON_QUANTITY);
    const wanted = Math.max(0, Math.min(cap, Math.floor(quantity)));

    let applied = false;
    setLines((current) => {
      // مخلفات باید قلم اصلی زنده داشته باشد؛ وگرنه بی‌صاحب می‌ماند.
      const parent = current.find((line) => line.key === parentLineKey && !line.parentKey);
      if (!parent) return current;
      applied = true;

      const existing = current.find((line) => line.key === key);
      if (wanted === 0) {
        return existing ? withoutLine(current, key) : current;
      }
      if (existing) {
        if (existing.quantity === wanted) return current;
        return current.map((line) =>
          line.key === key ? { ...line, quantity: wanted, price: item.price, stock: item.stock ?? null } : line,
        );
      }
      if (current.length >= CART_MAX_LINES) {
        applied = false;
        return current;
      }

      return [
        ...current,
        {
          key,
          parentKey: parentLineKey,
          productId,
          id: item.id,
          name: item.name,
          price: item.price,
          image: item.image,
          quantity: wanted,
          stock: item.stock ?? null,
        },
      ];
    });

    return applied;
  }, []);

  const setQuantity = useCallback((lineKey: string, quantity: number) => {
    setLines((current) => {
      const line = current.find((candidate) => candidate.key === lineKey);
      if (!line) return current;
      // مخلفات سقف اختصاصی دارد (هم‌اندازه با سقف سرور) نه سقف عمومی سبد.
      const cap = quantityCap(line.stock, line.parentKey ? CART_MAX_ADD_ON_QUANTITY : CART_MAX_QUANTITY);
      const next = Math.min(cap, Math.max(0, Math.floor(quantity)));
      if (next === 0) return withoutLine(current, lineKey);
      if (next === line.quantity) return current;
      return current.map((candidate) =>
        candidate.key === lineKey ? { ...candidate, quantity: next } : candidate,
      );
    });
  }, []);

  const removeItem = useCallback((lineKey: string) => {
    setLines((current) => withoutLine(current, lineKey));
  }, []);

  const clear = useCallback(() => setLines([]), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((sum, line) => sum + line.quantity, 0);
    const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
    return { lines, count, total, isOpen, addItem, setAddOn, setQuantity, removeItem, clear, openCart, closeCart };
  }, [lines, isOpen, addItem, setAddOn, setQuantity, removeItem, clear, openCart, closeCart]);

  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart(): CartContextValue {
  const context = use(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
