import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, ShoppingBag, Sparkles, Trash2, X } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { useAddOnPanel } from "@/context/AddOnContext";
import { useCart, type CartLine } from "@/context/CartContext";
import { formatPrice } from "@/data/content";
import { useLanguage } from "@/hooks/useLanguage";
import { useModalFocus } from "@/hooks/useModalFocus";
import { cn } from "@/utils/cn";

/**
 * کشوی سبد خرید.
 *
 * فقط نمایش و ویرایش سبد است؛ پرداخت در صفحه `/checkout` انجام می‌شود تا آدرس
 * قابل اشتراک و قابل بازگشت از درگاه داشته باشد.
 *
 * مخلفات هر غذا با تورفتگی زیر همان غذا نشان داده می‌شوند (پیوند `parentKey`) و
 * حذف غذا مخلفاتش را هم برمی‌دارد؛ اگر غذایی مخلفات پیشنهادی داشته باشد، دکمه
 * «افزودن مخلفات» پنل پیشنهاد را دوباره باز می‌کند.
 *
 * عمداً هیچ `data-*` موشنی روی این کامپوننت نیست: کشو روی هر مسیری باز می‌شود و
 * قرارداد انیمیشن اسکرول (`tests/motion.e2e.mjs`) فقط برای محتوای صفحه است.
 */
function CartLineRow({ line, isAddOn = false }: { line: CartLine; isAddOn?: boolean }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { setQuantity, removeItem, closeCart } = useCart();
  const { open } = useAddOnPanel();
  const name = line.name[language];
  /** سایز انتخاب‌شده (اگر آیتم واریانت داشته باشد). */
  const variantName = line.variantLabel?.[language] ?? null;
  /** نام کامل برای متن‌های دسترس‌پذیری، تا سایز هم اعلام شود. */
  const fullName = variantName ? `${name} — ${variantName}` : name;
  const cap = line.stock === null ? undefined : Math.max(1, line.stock);

  return (
    <li
      className={cn(
        "flex gap-3 rounded-2xl border p-3",
        isAddOn ? "border-dashed border-bun-line/80 bg-bun-paper/70 ms-4" : "border-bun-line bg-bun-surface",
      )}
    >
      {line.image ? (
        <img
          src={line.image}
          alt=""
          loading="lazy"
          className={cn("shrink-0 rounded-xl object-cover", isAddOn ? "size-12" : "size-16")}
        />
      ) : (
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-xl bg-bun-line/50 text-bun-muted",
            isAddOn ? "size-12" : "size-16",
          )}
        >
          <ShoppingBag className="size-5" aria-hidden="true" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`/menu/${line.id}`}
            className="line-clamp-2 text-sm font-black text-bun-text outline-none hover:text-bun-accent focus-visible:ring-2 focus-visible:ring-bun-gold"
          >
            {name}
          </Link>
          <button
            type="button"
            onClick={() => removeItem(line.key)}
            aria-label={t("cart.remove", { name: fullName })}
            className="cursor-pointer rounded-full p-1 text-bun-muted outline-none transition-colors hover:bg-bun-text/8 hover:text-bun-red focus-visible:ring-2 focus-visible:ring-bun-gold"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>

        {isAddOn ? (
          <p className="mt-1 text-[0.65rem] font-black uppercase tracking-[0.2em] text-bun-muted">
            {t("addOns.cartLabel")}
          </p>
        ) : null}

        {variantName ? (
          <p className="mt-1 text-xs font-bold text-bun-accent">{variantName}</p>
        ) : null}

        <p className="mt-1 text-xs font-bold text-bun-muted">
          {formatPrice(line.price, language)}
        </p>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-full border border-bun-line bg-bun-paper p-0.5">
            <button
              type="button"
              onClick={() => setQuantity(line.key, line.quantity - 1)}
              aria-label={t("cart.decrease", { name: fullName })}
              className="grid size-7 cursor-pointer place-items-center rounded-full text-bun-text outline-none transition-colors hover:bg-bun-text/8 focus-visible:ring-2 focus-visible:ring-bun-gold"
            >
              <Minus className="size-3.5" aria-hidden="true" />
            </button>
            <span className="min-w-6 text-center text-sm font-black text-bun-text" aria-live="polite">
              {line.quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity(line.key, line.quantity + 1)}
              disabled={cap !== undefined && line.quantity >= cap}
              aria-label={t("cart.increase", { name })}
              className="grid size-7 cursor-pointer place-items-center rounded-full text-bun-text outline-none transition-colors hover:bg-bun-text/8 focus-visible:ring-2 focus-visible:ring-bun-gold disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="size-3.5" aria-hidden="true" />
            </button>
          </div>
          <span className="text-sm font-black text-bun-text">
            {formatPrice(line.price * line.quantity, language)}
          </span>
        </div>

        {!isAddOn && line.addOnCount ? (
          <button
            type="button"
            onClick={() => {
              // کشو بسته می‌شود تا پنل پیشنهاد روی آن باز نشود.
              closeCart();
              open({ lineKey: line.key, itemId: line.id, name: line.name });
            }}
            className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-black text-bun-accent outline-none transition-colors hover:text-bun-red focus-visible:ring-2 focus-visible:ring-bun-gold"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            {t("addOns.manage")}
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function CartDrawer() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { lines, count, total, isOpen, closeCart, clear } = useCart();

  const panel = useRef<HTMLElement | null>(null);
  useModalFocus(panel, isOpen, closeCart);

  const hidden = language === "fa" ? "-100%" : "100%";

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-[70]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeCart}
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
          />

          <motion.aside
            ref={panel}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={t("cart.title")}
            initial={{ x: hidden }}
            animate={{ x: 0 }}
            exit={{ x: hidden }}
            transition={{ type: "tween", duration: 0.28, ease: "easeOut" }}
            className="absolute inset-y-0 end-0 flex w-[min(100vw,26rem)] flex-col border-s border-bun-line bg-bun-paper shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-bun-line px-5 py-4">
              <div>
                <h2 className="font-display text-lg font-black text-bun-text">{t("cart.title")}</h2>
                <p className="mt-0.5 text-xs font-bold text-bun-muted">
                  {t("cart.items", { count })}
                </p>
              </div>
              <Button
                variant="icon"
                size="icon"
                onClick={closeCart}
                aria-label={t("cart.close")}
                className="size-9"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </header>

            {lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                <span className="grid size-16 place-items-center rounded-full bg-bun-surface text-bun-muted">
                  <ShoppingBag className="size-7" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-black text-bun-text">{t("cart.empty")}</p>
                  <p className="mt-1 text-sm leading-6 text-bun-muted">{t("cart.emptyHint")}</p>
                </div>
                <Link
                  to="/menu"
                  onClick={closeCart}
                  className="rounded-full bg-bun-text/8 px-5 py-2.5 text-sm font-bold text-bun-text outline-none transition-colors hover:bg-bun-text/12 focus-visible:ring-2 focus-visible:ring-bun-gold"
                >
                  {t("cart.browseMenu")}
                </Link>
              </div>
            ) : (
              <>
                <ul className="flex-1 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
                  {lines
                    .filter((line) => !line.parentKey)
                    .map((line) => (
                      <li key={line.key} className="space-y-3">
                        <ul className="space-y-3">
                          <CartLineRow line={line} />
                          {/* مخلفات همین غذا بلافاصله زیر آن می‌آیند تا پیوندشان روشن باشد. */}
                          {lines
                            .filter((candidate) => candidate.parentKey === line.key)
                            .map((addOn) => (
                              <CartLineRow key={addOn.key} line={addOn} isAddOn />
                            ))}
                        </ul>
                      </li>
                    ))}
                </ul>

                <footer className="space-y-3 border-t border-bun-line px-5 py-4">
                  <div className="flex items-center justify-between text-sm font-bold text-bun-muted">
                    <span>{t("cart.subtotal")}</span>
                    <span className="font-display text-xl font-black text-bun-text">
                      {formatPrice(total, language)}
                    </span>
                  </div>
                  <Link
                    to="/checkout"
                    onClick={closeCart}
                    className="flex h-14 w-full items-center justify-center rounded-full bg-gradient-to-r from-bun-red via-bun-orange to-bun-gold text-base font-bold text-bun-ink shadow-lg shadow-bun-orange/20 outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-bun-gold active:scale-[0.97]"
                  >
                    {t("cart.checkout")}
                  </Link>
                  <button
                    type="button"
                    onClick={clear}
                    className="w-full cursor-pointer rounded-full px-4 py-2 text-sm font-bold text-bun-muted outline-none transition-colors hover:text-bun-red focus-visible:ring-2 focus-visible:ring-bun-gold"
                  >
                    {t("cart.clear")}
                  </button>
                </footer>
              </>
            )}
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
