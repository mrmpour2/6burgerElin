import { AnimatePresence, motion } from "framer-motion";
import { Check, MessageCircle, Plus, Send, ShoppingBag, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { apiBaseUrl, apiClient } from "@/api/client";
import { fetchPublicMenu } from "@/api/menu";
import { Button } from "@/components/ui/Button";
import { useCart } from "@/context/CartContext";
import { defaultVariant, formatPrice, hasVariants, priceRange } from "@/data/content";
import { useLanguage } from "@/hooks/useLanguage";
import type { MenuItem } from "@/types";
import { sanitizeInput } from "@/utils/sanitize";
import { getChatSessionId } from "@/utils/session";
import { cn } from "@/utils/cn";

/**
 * دستیار گفتگوی شیش برگر الین.
 *
 * این کامپوننت مسئول گفتگو است، نه سفارش: دکمه «محصولات فروشگاه» فهرست زنده را
 * نشان می‌دهد و هر آیتم را به **سبد سراسری سایت** اضافه می‌کند
 * (`@/context/CartContext`). پیش از این یک سبد و فرم پرداخت جداگانه داخل همین
 * کامپوننت بود که با سبد سایت هم‌خوان نبود و متن‌هایش هم هاردکد فارسی بودند؛
 * حالا پرداخت فقط در `/checkout` انجام می‌شود تا یک مسیر واحد وجود داشته باشد.
 *
 * گفتگو با `POST /api/chat` (استریم) کار می‌کند و تاریخچه نشست از
 * `GET /api/conversations/:sessionId` بازیابی می‌شود.
 */

/** پیام استخراج‌شده از `parts` برای نمایش. */
function messageText(message: { parts?: Array<{ type: string; text?: string }> }): string {
  return (
    message.parts
      ?.filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("") ?? ""
  );
}

export default function ChatBox() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { addItem, count, openCart } = useCart();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [addedId, setAddedId] = useState<string | null>(null);
  const sessionId = useMemo(() => getChatSessionId(), []);
  const endRef = useRef<HTMLDivElement>(null);
  const addedTimer = useRef<number | null>(null);

  // زبان از طریق ref خوانده می‌شود تا transport یک‌بار ساخته شود ولی هر پیام با
  // آخرین زبان انتخاب‌شده برود (`body` می‌تواند تابع باشد).
  const languageRef = useRef(language);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${apiBaseUrl}/chat`,
        body: () => ({ language: languageRef.current, sessionId }),
      }),
    [sessionId],
  );

  const { messages, sendMessage, status, setMessages } = useChat({ transport });

  const isLoading = status === "streaming" || status === "submitted";

  /**
   * تاریخچه نشست از سرور بازیابی می‌شود.
   *
   * اگر نشست تازه باشد (پیام ذخیره‌شده‌ای نیست) هم پیام خوشامد نمایش داده
   * می‌شود؛ پیش از این فقط در حالت خطای درخواست این کار انجام می‌شد و کاربر با
   * یک پنجره کاملاً خالی روبه‌رو می‌شد.
   */
  useEffect(() => {
    let cancelled = false;
    const greeting = () => ({
      id: "greeting",
      role: "assistant" as const,
      parts: [{ type: "text" as const, text: t("chat.greeting") }],
    });

    apiClient
      .get(`/conversations/${encodeURIComponent(sessionId)}`)
      .then(({ data }) => {
        if (cancelled) return;
        const stored: Array<{ id: string; role: "user" | "assistant"; content: string }> = Array.isArray(data.messages)
          ? data.messages
          : [];
        if (stored.length === 0) {
          setMessages([greeting()]);
          return;
        }
        setMessages(
          stored.map((message) => ({
            id: message.id,
            role: message.role,
            parts: [{ type: "text" as const, text: message.content }],
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setMessages([greeting()]);
      });

    return () => {
      cancelled = true;
    };
  }, [language, sessionId, setMessages, t]);

  // فهرست زنده از همان کش صفحه منو می‌آید، پس درخواست تکراری زده نمی‌شود.
  const toggleCatalog = useCallback(() => {
    setCatalogOpen((value) => !value);
    if (products.length > 0 || catalogStatus === "loading") return;
    setCatalogStatus("loading");
    fetchPublicMenu()
      .then((items) => {
        setProducts(items.filter((item) => item.productId));
        setCatalogStatus("ready");
      })
      .catch(() => setCatalogStatus("error"));
  }, [products.length, catalogStatus]);

  const addProduct = useCallback(
    (item: MenuItem) => {
      // آیتم دارای سایز با سایز پیش‌فرض اضافه می‌شود؛ تغییر سایز در صفحه محصول
      // انجام می‌شود تا این پنل ساده بماند.
      if (!addItem(item, 1, defaultVariant(item)?.key)) return;
      setAddedId(item.productId ?? null);
      if (addedTimer.current !== null) window.clearTimeout(addedTimer.current);
      addedTimer.current = window.setTimeout(() => setAddedId(null), 1600);
    },
    [addItem],
  );

  useEffect(
    () => () => {
      if (addedTimer.current !== null) window.clearTimeout(addedTimer.current);
    },
    [],
  );

  // اسکرول خودکار
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, catalogOpen]);

  const send = useCallback(() => {
    const value = sanitizeInput(input.trim());
    if (!value || isLoading) return;

    sendMessage({ text: value });
    setInput("");
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    [send],
  );

  return (
    <div
      className={cn(
        "fixed bottom-4 z-50 sm:bottom-6",
        language === "fa" ? "left-4 sm:left-6" : "right-4 sm:right-6",
      )}
    >
      <AnimatePresence>
        {open ? (
          <motion.section
            key="chat-window"
            role="dialog"
            aria-label={t("chat.title")}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="mb-3 flex h-[min(70vh,520px)] w-[min(calc(100vw-2rem),360px)] origin-bottom flex-col overflow-hidden rounded-[1.5rem] border border-bun-line bg-bun-paper shadow-2xl shadow-black/20"
          >
            <header className="flex items-center justify-between bg-gradient-to-r from-bun-burgundy to-bun-red px-4 py-3.5 text-white">
              <div>
                <h2 className="text-sm font-black">{t("chat.title")}</h2>
                <p className="mt-0.5 text-[11px] text-white/70">{t("chat.status")}</p>
              </div>
              <Button
                variant="icon"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label={t("chat.close")}
                className="size-9 text-white hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </header>

            <div className="flex flex-wrap items-center gap-2 border-b border-bun-line px-3 py-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={toggleCatalog}
                aria-expanded={catalogOpen}
                className="gap-1.5 text-xs"
              >
                <ShoppingBag className="size-3.5" aria-hidden="true" />
                {t("chat.catalog")}
              </Button>
              {count > 0 ? (
                <Button type="button" size="sm" onClick={openCart} className="gap-1.5 text-xs">
                  {t("chat.viewCart", { count })}
                </Button>
              ) : null}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
              {catalogOpen ? (
                <section className="space-y-2" aria-label={t("chat.catalogTitle")}>
                  <h3 className="text-sm font-bold text-bun-text">{t("chat.catalogTitle")}</h3>
                  {catalogStatus === "loading" ? (
                    <p className="text-xs text-bun-muted">{t("common.loading")}</p>
                  ) : null}
                  {catalogStatus === "error" ? (
                    <p role="status" className="text-xs font-bold text-bun-muted">
                      {t("chat.catalogError")}
                    </p>
                  ) : null}
                  {catalogStatus === "ready" && products.length === 0 ? (
                    <p className="text-xs text-bun-muted">{t("menuPage.empty")}</p>
                  ) : null}
                  {products.map((product) => (
                    <article
                      key={product.productId}
                      className="flex items-center gap-3 rounded-xl border border-bun-line bg-bun-surface p-2.5"
                    >
                      {product.image ? (
                        <img
                          src={product.image}
                          alt=""
                          loading="lazy"
                          className="size-16 shrink-0 rounded-lg object-cover"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-bun-text">{product.name[language]}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-bun-muted">
                          {product.description[language]}
                        </p>
                        <p className="mt-1 text-xs font-bold text-bun-accent">
                          {hasVariants(product)
                            ? t("product.from", {
                                price: formatPrice(priceRange(product).min, language),
                              })
                            : formatPrice(product.price, language)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addProduct(product)}
                        aria-label={`${t("cart.add")}: ${product.name[language]}`}
                        className={cn(
                          "grid size-9 shrink-0 cursor-pointer place-items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-bun-gold",
                          addedId === product.productId
                            ? "bg-bun-orange text-bun-ink"
                            : "bg-bun-paper text-bun-text hover:bg-bun-orange/15 hover:text-bun-accent",
                        )}
                      >
                        {addedId === product.productId ? (
                          <Check className="size-4" aria-hidden="true" />
                        ) : (
                          <Plus className="size-4" aria-hidden="true" />
                        )}
                      </button>
                    </article>
                  ))}
                </section>
              ) : null}

              {messages.map((message) => {
                const text = messageText(message);
                if (!text) return null;

                return (
                  <div
                    key={message.id}
                    className={cn(
                      "max-w-[86%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-6",
                      message.role === "assistant"
                        ? "bg-bun-surface text-bun-text"
                        : "ms-auto bg-bun-red text-white",
                    )}
                  >
                    {text}
                  </div>
                );
              })}

              {isLoading && messages.at(-1)?.role === "user" ? (
                <div
                  className="flex w-fit items-center gap-1 rounded-2xl bg-bun-surface px-4 py-3"
                  aria-label={t("chat.typing")}
                >
                  {[0, 1, 2].map((index) => (
                    <motion.span
                      key={index}
                      className="size-1.5 rounded-full bg-bun-muted"
                      animate={{ opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
                      transition={{ duration: 0.75, repeat: Infinity, delay: index * 0.12 }}
                    />
                  ))}
                </div>
              ) : null}

              <div ref={endRef} />
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
              className="flex gap-2 border-t border-bun-line p-3"
            >
              <label htmlFor="chat-message" className="sr-only">
                {t("chat.placeholder")}
              </label>
              <input
                id="chat-message"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("chat.placeholder")}
                className="min-w-0 flex-1 rounded-full border border-bun-line bg-bun-surface px-4 text-sm text-bun-text outline-none placeholder:text-bun-muted focus:border-bun-orange focus:ring-2 focus:ring-bun-orange/20"
                aria-describedby="chat-help"
              />
              <p id="chat-help" className="sr-only">
                {t("chat.placeholder")}
              </p>
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
                aria-label={t("chat.send")}
              >
                <Send
                  className={cn("size-4", language === "fa" && "rotate-180")}
                  aria-hidden="true"
                />
              </Button>
            </form>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
        <Button
          onClick={() => setOpen((value) => !value)}
          size="icon"
          aria-label={open ? t("chat.close") : t("chat.open")}
          aria-expanded={open}
          className="relative size-14 shadow-xl shadow-bun-orange/30"
        >
          {open ? <X className="size-5" aria-hidden="true" /> : <MessageCircle className="size-5" aria-hidden="true" />}
          {!open && count > 0 ? (
            <span className="absolute end-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-bun-ink px-1 text-[10px] font-black leading-5 text-white">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </Button>
      </motion.div>
    </div>
  );
}
