import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Minus, Plus, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchMenuItemAddOns } from "@/api/menu";
import { MenuItemImage } from "@/components/MenuItemImage";
import { Button } from "@/components/ui/Button";
import { useAddOnPanel } from "@/context/AddOnContext";
import { CART_MAX_ADD_ON_QUANTITY, useCart } from "@/context/CartContext";
import { formatPrice } from "@/data/content";
import { useLanguage } from "@/hooks/useLanguage";
import { useModalFocus } from "@/hooks/useModalFocus";
import type { MenuItem } from "@/types";

/**
 * پنل «مخلفات پیشنهادی» (Smart Add-ons).
 *
 * موبایل: Bottom Sheet و دسکتاپ: پنجره وسط‌چین؛ هر دو یک محتوا دارند. انتخاب‌ها
 * تا زدن دکمه نهایی فقط در همین پنل می‌مانند و بعد یک‌جا (و به‌صورت «تعداد مطلق»)
 * در سبد ثبت می‌شوند، پس نه سطر تکراری ساخته می‌شود و نه جمع سبد چند‌بار عوض
 * می‌شود.
 *
 * عمداً هیچ `data-*` موشنی روی این کامپوننت نیست (مثل `CartDrawer`): پنل روی هر
 * مسیری و بعد از بارگذاری صفحه باز می‌شود، در حالی که قرارداد انیمیشن اسکرول
 * (`tests/motion.e2e.mjs`) فقط محتوای اولیه صفحه را می‌سنجد. تصاویر مخلفات هم با
 * `reveal={false}` رندر می‌شوند تا خارج از آن قرارداد بمانند.
 */

/** سقف تعداد یک مخلفات: موجودی اعلام‌شده و سقف سرور، هر کدام کمتر بود. */
function addOnCap(item: MenuItem): number {
  const stock = item.stock;
  if (stock === undefined || !Number.isFinite(stock)) return CART_MAX_ADD_ON_QUANTITY;
  return Math.max(0, Math.min(Math.floor(stock), CART_MAX_ADD_ON_QUANTITY));
}

/** آیا این مخلفات قابل سفارش است؟ */
function isAvailable(item: MenuItem): boolean {
  return item.available !== false && addOnCap(item) > 0;
}

export function AddOnSheet() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { lines, setAddOn } = useCart();
  const { target, close } = useAddOnPanel();

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [addOns, setAddOns] = useState<MenuItem[]>([]);
  /** تعداد انتخاب‌شده هر مخلفات در همین پنل (کلید: `productId`). */
  const [picked, setPicked] = useState<Record<string, number>>({});
  /** تلاش دوباره پس از خطا. */
  const [attempt, setAttempt] = useState(0);

  const panel = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  const lineKey = target?.lineKey ?? null;
  const itemId = target?.itemId ?? null;
  /** قلم اصلی سبد که این مخلفات به آن وصل می‌شوند. */
  const parentLine = lineKey ? lines.find((line) => line.key === lineKey) : undefined;

  // فهرست مخلفات این غذا؛ فقط هنگام باز بودن پنل و یک‌بار برای هر غذا.
  useEffect(() => {
    if (!itemId) return;
    let active = true;
    setStatus("loading");

    fetchMenuItemAddOns(itemId)
      .then((items) => {
        if (!active) return;
        setAddOns(items);
        setStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setAddOns([]);
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [itemId, attempt]);

  // انتخاب‌های فعلی همان قلم از سبد پیش‌پر می‌شود تا پنل نقش «ویرایشگر» داشته
  // باشد؛ دوبار باز‌کردن، سفارش را دوبار سنگین نمی‌کند.
  useEffect(() => {
    if (!lineKey) return;
    const existing: Record<string, number> = {};
    for (const line of lines) {
      if (line.parentKey === lineKey) existing[line.productId] = line.quantity;
    }
    setPicked(existing);
    // فقط با تغییر غذا؛ تغییر سبد نباید انتخاب‌های در‌حال‌ویرایش کاربر را پاک کند.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineKey]);

  // اگر غذای اصلی در همین حین از سبد حذف شود، پنل بسته می‌شود (مخلفات بی‌قلم
  // اصلی نه قابل نمایش است و نه قابل سفارش).
  useEffect(() => {
    if (lineKey && !parentLine) close();
  }, [lineKey, parentLine, close]);

  useModalFocus(panel, Boolean(target), close);

  const changeQuantity = useCallback((item: MenuItem, next: number) => {
    const key = item.productId ?? item.id;
    const value = Math.max(0, Math.min(addOnCap(item), next));
    setPicked((current) => {
      const updated = { ...current };
      if (value === 0) delete updated[key];
      else updated[key] = value;
      return updated;
    });
  }, []);

  /** ثبت یک‌جای انتخاب‌ها در سبد و بستن پنل. */
  const apply = useCallback(() => {
    if (!lineKey) return;
    for (const item of addOns) setAddOn(lineKey, item, picked[item.productId ?? item.id] ?? 0);
    close();
  }, [addOns, close, lineKey, picked, setAddOn]);

  const quantityOf = (item: MenuItem) => picked[item.productId ?? item.id] ?? 0;
  const pickedCount = addOns.reduce((sum, item) => sum + quantityOf(item), 0);
  const baseTotal = parentLine ? parentLine.price * parentLine.quantity : 0;
  const addOnTotal = addOns.reduce((sum, item) => sum + item.price * quantityOf(item), 0);
  const finalTotal = baseTotal + addOnTotal;
  const hasPicks = pickedCount > 0;

  return (
    <AnimatePresence>
      {target && parentLine ? (
        <div className="fixed inset-0 z-[75]">
          {/* کلیک روی پس‌زمینه = «ادامه بدون مخلفات» */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
          />

          <div className="pointer-events-none absolute inset-0 flex items-end justify-center sm:items-center sm:p-6">
            <motion.div
              ref={panel}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              initial={{ y: 48, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 32, opacity: 0, scale: 0.99 }}
              transition={{ type: "tween", duration: 0.26, ease: "easeOut" }}
              className="pointer-events-auto flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-bun-line bg-bun-paper shadow-2xl outline-none sm:max-h-[82vh] sm:max-w-lg sm:rounded-[1.75rem]"
            >
              <header className="flex items-start justify-between gap-4 border-b border-bun-line px-5 py-4">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-bun-accent">
                    {t("addOns.kicker")}
                  </p>
                  <h2 id={titleId} className="mt-1 font-display text-lg font-black text-bun-text">
                    {t("addOns.title", { name: parentLine.name[language] })}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-bun-muted">{t("addOns.subtitle")}</p>
                </div>
                <Button
                  variant="icon"
                  size="icon"
                  onClick={close}
                  aria-label={t("addOns.close")}
                  className="size-9 shrink-0"
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </header>

              <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                {status === "loading" ? (
                  <p
                    role="status"
                    className="flex items-center justify-center gap-2 py-10 text-sm font-bold text-bun-muted"
                  >
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    {t("addOns.loading")}
                  </p>
                ) : status === "error" ? (
                  <div role="status" className="py-8 text-center">
                    <p className="text-sm font-bold text-bun-muted">{t("addOns.error")}</p>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-4"
                      onClick={() => setAttempt((current) => current + 1)}
                    >
                      {t("addOns.retry")}
                    </Button>
                  </div>
                ) : addOns.length === 0 ? (
                  <p role="status" className="py-10 text-center text-sm font-bold text-bun-muted">
                    {t("addOns.empty")}
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {addOns.map((item) => {
                      const quantity = quantityOf(item);
                      const available = isAvailable(item);
                      const cap = addOnCap(item);
                      return (
                        <li
                          key={item.productId ?? item.id}
                          className="flex items-center gap-3 rounded-2xl border border-bun-line bg-bun-surface p-3"
                        >
                          <MenuItemImage
                            item={item}
                            reveal={false}
                            className="size-16 shrink-0 rounded-xl"
                            imageClassName="text-[0.55rem]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm font-black text-bun-text">
                              {item.name[language]}
                            </p>
                            <p className="mt-1 text-sm font-bold text-bun-accent">
                              {formatPrice(item.price, language)}
                            </p>
                            {available ? null : (
                              <p className="mt-1 text-xs font-black text-bun-red">
                                {t("addOns.soldOut")}
                              </p>
                            )}
                          </div>

                          {available ? (
                            quantity > 0 ? (
                              <div className="flex shrink-0 items-center gap-1 rounded-full border border-bun-line bg-bun-paper p-0.5">
                                <button
                                  type="button"
                                  onClick={() => changeQuantity(item, quantity - 1)}
                                  aria-label={t("addOns.decrease", { name: item.name[language] })}
                                  className="grid size-8 cursor-pointer place-items-center rounded-full text-bun-text outline-none transition-colors hover:bg-bun-text/8 focus-visible:ring-2 focus-visible:ring-bun-gold"
                                >
                                  <Minus className="size-3.5" aria-hidden="true" />
                                </button>
                                <span
                                  aria-live="polite"
                                  className="min-w-6 text-center text-sm font-black text-bun-text"
                                >
                                  {quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => changeQuantity(item, quantity + 1)}
                                  disabled={quantity >= cap}
                                  aria-label={t("addOns.increase", { name: item.name[language] })}
                                  className="grid size-8 cursor-pointer place-items-center rounded-full text-bun-text outline-none transition-colors hover:bg-bun-text/8 focus-visible:ring-2 focus-visible:ring-bun-gold disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <Plus className="size-3.5" aria-hidden="true" />
                                </button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="shrink-0"
                                onClick={() => changeQuantity(item, 1)}
                                aria-label={t("addOns.addAria", { name: item.name[language] })}
                              >
                                <Plus className="size-4" aria-hidden="true" />
                                {t("addOns.add")}
                              </Button>
                            )
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <footer className="space-y-3 border-t border-bun-line px-5 py-4">
                <dl className="space-y-1.5 text-sm font-bold text-bun-muted">
                  <div className="flex items-center justify-between gap-4">
                    <dt>{t("addOns.base")}</dt>
                    <dd className="text-bun-text">{formatPrice(baseTotal, language)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt>{t("addOns.addOnTotal")}</dt>
                    <dd className="text-bun-text">{formatPrice(addOnTotal, language)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-bun-line pt-2">
                    <dt className="text-bun-text">{t("addOns.total")}</dt>
                    <dd aria-live="polite" className="font-display text-xl font-black text-bun-text">
                      {formatPrice(finalTotal, language)}
                    </dd>
                  </div>
                </dl>

                {/* یک دکمه اصلی در هر حالت: با انتخاب → ثبت، بی‌انتخاب → عبور */}
                {hasPicks ? (
                  <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center">
                    <Button onClick={apply} className="w-full sm:flex-1">
                      {t("addOns.apply", { count: pickedCount })}
                    </Button>
                    <Button variant="ghost" onClick={close} className="w-full sm:w-auto">
                      {t("addOns.skip")}
                    </Button>
                  </div>
                ) : (
                  <Button onClick={close} className="w-full">
                    {t("addOns.skip")}
                  </Button>
                )}
              </footer>
            </motion.div>
          </div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
