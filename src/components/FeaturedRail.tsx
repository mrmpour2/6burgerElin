import { ArrowRight, Star } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AddToCartButton } from "@/components/AddToCartButton";
import { MenuItemImage } from "@/components/MenuItemImage";
import { MotionText } from "@/components/MotionText";
import { buttonVariants } from "@/components/ui/Button";
import {
  featuredMenuItems,
  formatPrice,
  hasVariants,
  itemVariants,
  mergeCatalogItems,
  priceRange,
} from "@/data/content";
import { useLanguage } from "@/hooks/useLanguage";
import { usePublicMenu } from "@/hooks/usePublicMenu";
import { prefersReducedMotion, refreshMotion } from "@/motion/smoothScroll";
import type { MenuItem } from "@/types";
import { cn } from "@/utils/cn";

/* ---------------------------------------------------------------------------
 * Constants
--------------------------------------------------------------------------- */

/** حداکثر کارت‌های ریل؛ بیشتر از این، ریل بی‌پایان و پیمایش خسته‌کننده می‌شود. */
const MAX_FEATURED_ITEMS = 6;

/** موجودی این عدد یا کمتر ⇒ نشان «موجودی محدود» روی کارت. */
const LOW_STOCK_THRESHOLD = 5;

/** ارقام فارسی برای شماره‌گذاری دو رقمی کارت‌ها. */
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/* ---------------------------------------------------------------------------
 * Pure helpers
--------------------------------------------------------------------------- */

/** شمارهٔ دو رقمی کارت با ارقام زبان فعال («۰۱»، «02») — جزئیات سرمقاله‌ای ریل. */
function cardIndexLabel(index: number, language: "fa" | "en"): string {
  const padded = String(index + 1).padStart(2, "0");
  if (language !== "fa") return padded;
  return padded.replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

/**
 * انتخاب و ترتیب کارت‌های ریل.
 *
 * ترتیب: اول آیتم‌های کاتالوگ (اگر مدیر آیتمی را `featured` علامت بزند)، بعد
 * محصولات زندهٔ پنل به همان ترتیبی که `/api/public/menu` می‌دهد. آیتم‌های
 * ناموجود به انتهای ریل می‌روند تا کارت‌های قابل سفارش جلوتر باشند. هیچ داده‌ای
 * ساخته نمی‌شود؛ فقط همان محصولات واقعی منو نمایش داده می‌شوند.
 */
function selectFeaturedItems(catalog: readonly MenuItem[], live: readonly MenuItem[]): MenuItem[] {
  const merged = mergeCatalogItems(catalog, live);
  const orderable = merged.filter((item) => item.available !== false);
  const soldOut = merged.filter((item) => item.available === false);
  return [...orderable, ...soldOut].slice(0, MAX_FEATURED_ITEMS);
}

/* ---------------------------------------------------------------------------
 * Pieces
--------------------------------------------------------------------------- */

/** برچسب کوچک روی تصویر (پیشنهاد سرآشپز، موجودی محدود، ناموجود). */
function CardBadge({ tone, children }: { tone: "gold" | "ink"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1.5 text-[11px] font-black backdrop-blur-md",
        tone === "gold" ? "bg-bun-gold/92 text-bun-ink" : "bg-bun-ink/85 text-white",
      )}
    >
      {children}
    </span>
  );
}

interface FeaturedCardProps {
  item: MenuItem;
  index: number;
  /** برای پیمایش با صفحه‌کلید، هر کارت باید ارجاع DOM بدهد. */
  register: (index: number, node: HTMLElement | null) => void;
}

/**
 * یک کارت ریل: تصویر پرترهٔ بزرگ با نسبت ثابت، نام و قیمت روی تصویر، توضیح و
 * اکشن‌ها زیر آن. همان قراردادهای `MenuCard` (لینک جزئیات، دکمهٔ سبد) رعایت
 * شده تا رفتار خرید در کل سایت یکسان بماند.
 *
 * نکته: کارت‌ها عمداً `data-reveal-item` ندارند. محصولات با تأخیر از API
 * می‌رسند و `initScrollReveals` گروهی را که یک‌بار claim شده دوباره پردازش
 * نمی‌کند؛ پس کارت تازه‌رسیده هرگز claim نمی‌شد و با قاعدهٔ
 * `html.has-motion [data-reveal-item] { visibility: hidden }` نامرئی می‌ماند.
 * به‌جای آن، با تغییر تعداد کارت‌ها `refreshMotion()` صدا زده می‌شود.
 */
function FeaturedCard({ item, index, register }: FeaturedCardProps) {
  const { t } = useTranslation();
  const language = useLanguage();
  const from = priceRange(item).min;
  const soldOut = item.available === false;
  const lowStock =
    !soldOut &&
    typeof item.stock === "number" &&
    item.stock > 0 &&
    item.stock <= LOW_STOCK_THRESHOLD;
  const description = (item.description[language] ?? "").trim();
  const kickerTracking = language === "fa" ? "tracking-normal" : "tracking-[0.24em]";

  return (
    <article
      ref={(node) => register(index, node)}
      className="group flex h-full w-[78vw] max-w-84 shrink-0 snap-start flex-col sm:w-76 lg:w-82"
    >
      <Link
        to={`/menu/${item.id}`}
        data-cursor-label={t("common.viewDetails")}
        aria-label={`${t("common.viewDetails")}: ${item.name[language]}`}
        className="relative block aspect-4/5 overflow-hidden rounded-[1.75rem] bg-bun-surface outline-none ring-bun-gold focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:ring-offset-bun-paper"
      >
        <MenuItemImage
          item={item}
          sizes="(max-width: 640px) 78vw, (max-width: 1024px) 45vw, 20rem"
          className="h-full w-full"
          imageClassName="transition-transform duration-700 ease-out group-hover:scale-[1.06]"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-bun-ink/92 via-bun-ink/35 to-transparent"
          aria-hidden="true"
        />
        <span
          aria-hidden="true"
          className="absolute end-5 top-4 font-display text-xs font-black tabular-nums text-white/55"
        >
          {cardIndexLabel(index, language)}
        </span>
        {item.featured || lowStock || soldOut ? (
          <div className="absolute start-5 top-4 flex flex-col items-start gap-2">
            {item.featured ? <CardBadge tone="gold">{t("home.featuredChefPick")}</CardBadge> : null}
            {soldOut ? <CardBadge tone="ink">{t("menuPage.unavailable")}</CardBadge> : null}
            {lowStock ? <CardBadge tone="gold">{t("home.featuredLowStock")}</CardBadge> : null}
          </div>
        ) : null}
        <div className="absolute inset-x-5 bottom-5">
          <div className="flex items-center justify-between gap-3">
            <p className={cn("text-[11px] font-black uppercase text-white/70", kickerTracking)}>
              {t(`menuPage.categories.${item.category}`)}
            </p>
            {item.rating === undefined ? null : (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-white/85">
                <Star className="size-3.5 fill-bun-gold text-bun-gold" aria-hidden="true" />
                {item.rating}
              </span>
            )}
          </div>
          <h3 className="mt-2 font-display text-2xl font-black leading-tight tracking-tight text-white">
            {item.name[language]}
          </h3>
          <p className="mt-2 text-sm font-black text-bun-gold">
            {hasVariants(item)
              ? t("product.from", { price: formatPrice(from, language) })
              : formatPrice(item.price, language)}
          </p>
        </div>
      </Link>

      <div className="flex flex-1 flex-col px-1 pb-1 pt-5">

        {hasVariants(item) ? (
          <p className="mt-2 text-xs font-bold text-bun-accent">
            {itemVariants(item)
              .map((candidate) => candidate.label[language])
              .join(" · ")}
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <AddToCartButton item={item} size="sm" variant="secondary" showUnavailableHint={false} />
          <Link
            to={`/menu/${item.id}`}
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "px-0 hover:bg-transparent hover:text-bun-accent",
            })}
          >
            {t("common.viewDetails")}
            <ArrowRight
              className={cn("size-4", language === "fa" && "rotate-180")}
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>
    </article>
  );
}

/* ---------------------------------------------------------------------------
 * Loading / fallback
--------------------------------------------------------------------------- */

/**
 * کارت‌های جانگهدار (اسکلتون) *داخل* ریل.
 *
 * عمداً داخل `data-horizontal-track` رندر می‌شوند تا ساختار ریل — و در نتیجه
 * پین‌شدن دسکتاپ (`initHorizontalGalleries`) — از لحظهٔ اول پایدار باشد و با
 * رسیدن محصولات واقعی فقط محتوا عوض شود، نه قالب. در حالت «در حال بارگذاری»
 * نبض می‌گیرند؛ وقتی API پاسخ داده ولی محصولی نیست، ساکن می‌مانند تا شبیه
 * «هنوز در حال لود» به نظر نرسند.
 */
function FeaturedRailPlaceholders({ pulsing }: { pulsing: boolean }) {
  return (
    <>
      {[0, 1, 2].map((key) => (
        <div
          key={key}
          aria-hidden="true"
          className="w-[78vw] max-w-[21rem] shrink-0 sm:w-[19rem] lg:w-[20.5rem]"
        >
          <span
            className={cn(
              "block aspect-[4/5] rounded-[1.75rem] bg-bun-text/8",
              pulsing && "animate-pulse",
            )}
          />
          {pulsing ? (
            <div className="mt-5 space-y-3 px-1">
              <span className="block h-4 w-full animate-pulse rounded-full bg-bun-text/8" />
              <span className="block h-4 w-2/3 animate-pulse rounded-full bg-bun-text/8" />
              <span className="block h-10 w-32 animate-pulse rounded-full bg-bun-text/8" />
            </div>
          ) : null}
        </div>
      ))}
    </>
  );
}

/** پیام کوتاه برای حالت‌های خطا/خالی؛ بدون هیچ محصول ساختگی. */
function FeaturedRailNote({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="mt-8 rounded-2xl border border-bun-line bg-bun-surface/60 px-5 py-3.5 text-center text-sm font-bold text-bun-muted lg:mt-6"
    >
      {children}
    </p>
  );
}

/**
 * کارت پایانی ریل: دعوت به دیدن کل منو.
 *
 * این کارت هم ریل را «تمام» می‌کند و هم تضمین می‌کند ریل در دسکتاپ همیشه
 * فاصلهٔ افقی کافی برای پین‌شدن داشته باشد (`initHorizontalGalleries` با کمتر
 * از ۸۰ پیکسل فاصله، ریل را پین نمی‌کند).
 */
function FeaturedRailEndCard() {
  const { t } = useTranslation();
  const language = useLanguage();

  return (
    <Link
      to="/menu"
      data-reveal-item=""
      data-magnetic="0.12"
      data-cursor-label={t("home.featuredExploreTitle")}
      className="group flex aspect-[4/5] w-[78vw] max-w-[21rem] shrink-0 snap-start flex-col justify-between rounded-[1.75rem] border border-white/10 bg-bun-ink p-6 text-white outline-none ring-bun-gold focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:ring-offset-bun-paper sm:w-[19rem] lg:w-[26rem] lg:max-w-none"
    >
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-bun-gold text-bun-ink transition-transform duration-500 ease-out group-hover:-rotate-12">
        <ArrowRight className={cn("size-5", language === "fa" && "rotate-180")} aria-hidden="true" />
      </span>
      <span className="block">
        <span className="block font-display text-3xl font-black leading-tight tracking-tight">
          {t("home.featuredExploreTitle")}
        </span>
        <span className="mt-3 block text-sm leading-6 text-white/70">
          {t("home.featuredExploreCopy")}
        </span>
      </span>
    </Link>
  );
}

/* ---------------------------------------------------------------------------
 * Section
--------------------------------------------------------------------------- */

/**
 * بخش «پرطرفدارها» — گالری سرمقاله‌ای محصولات (Editorial Premium).
 *
 * قواعد طراحی:
 *   - تصویر ستون اصلی است: کارت‌ها با نسبت ثابت `4/5`، شمارهٔ دو رقمی، نام و
 *     قیمت روی تصویر، و متن‌های پشتیبان زیر آن. فاصله‌ها سخاوتمندانه و
 *     سلسله‌مراتب خواندن روشن است.
 *   - موبایل/تبلت: ریل با اسکرول بومی و `snap` حرکت می‌کند (لمس طبیعی)، ولی
 *     با کلیدهای جهت‌دار و `Home`/`End` هم قابل پیمایش است.
 *   - دسکتاپ: ریل در `src/motion/motionSystem.ts` (کمک `data-horizontal-track`)
 *     به حرکت افقی پین می‌شود؛ تیتر در همان فریم پین‌شده کمی جمع‌تر است تا
 *     کارت‌ها کامل در قاب بمانند. در این حالت ریل اسکرول مستقل ندارد، پس
 *     کلیدها را نمی‌دزدیم و همان کلیدها صفحه را جلو می‌برند.
 *   - بدون دادهٔ ساختگی: کارت‌ها فقط از منوی واقعی (`usePublicMenu` روی
 *     `/api/public/menu`) می‌آیند. تا رسیدن پاسخ، کارت‌های جانگهدار داخل
 *     همان ریل نشان داده می‌شوند تا نه صفحه بپرد و نه پین دسکتاپ از دست برود؛
 *     اگر پاسخ بیاید و محصولی نباشد، یک پیام کوتاه بالای ریل می‌آید.
 */
export function FeaturedRail() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { items: liveItems, status } = usePublicMenu();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);

  const isRtl = language === "fa";
  const items = useMemo(() => selectFeaturedItems(featuredMenuItems, liveItems), [liveItems]);
  const hasItems = items.length > 0;
  const itemCount = items.length;
  const previousCount = useRef(itemCount);

  /**
   * محصولات با تأخیر می‌رسند و عرض ریل (و در نتیجه طول پین دسکتاپ) را عوض
   * می‌کنند؛ ScrollTrigger باید دوباره اندازه بگیرد. همان کاری که `Layout`
   * بعد از تغییر مسیر/زبان با `refreshMotion()` انجام می‌دهد.
   */
  useEffect(() => {
    if (previousCount.current === itemCount) return;
    previousCount.current = itemCount;
    refreshMotion();
  }, [itemCount]);

  const registerCard = useCallback((index: number, node: HTMLElement | null) => {
    cardRefs.current[index] = node;
  }, []);

  /**
   * پیمایش ریل با کلید. از `scrollIntoView` استفاده می‌کنیم چون برخلاف
   * `scrollBy`/`scrollTo` در هر دو جهت LTR و RTL درست کار می‌کند (مرورگر خودش
   * لبهٔ «شروع» را می‌فهمد).
   */
  const moveRail = useCallback(
    (target: "next" | "prev" | "first" | "last") => {
      const track = trackRef.current;
      if (!track) return;
      const cards = cardRefs.current.filter((card): card is HTMLElement => card !== null);
      if (cards.length === 0) return;

      const trackRect = track.getBoundingClientRect();
      // فاصلهٔ لبهٔ شروع هر کارت از لبهٔ شروع ریل (منفی یعنی از دید خارج شده).
      const fromStart = (card: HTMLElement) => {
        const rect = card.getBoundingClientRect();
        return isRtl ? trackRect.right - rect.right : rect.left - trackRect.left;
      };

      let current = 0;
      cards.forEach((card, index) => {
        if (fromStart(card) <= 4) current = index;
      });

      const lastIndex = cards.length - 1;
      const index =
        target === "first"
          ? 0
          : target === "last"
            ? lastIndex
            : Math.min(Math.max(current + (target === "next" ? 1 : -1), 0), lastIndex);

      const card = cards[index];
      if (!card) return;
      card.scrollIntoView({
        inline: target === "last" ? "end" : "start",
        block: "nearest",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    },
    [isRtl],
  );

  /** کلیدهای جهت با جهت صفحه هم‌راستا می‌شوند (RTL برعکس LTR) — مثل `TableTalk`. */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const track = event.currentTarget;
      // در حالت پین‌شدهٔ دسکتاپ ریل اسکرول مستقل ندارد؛ کلیدها را رها می‌کنیم.
      if (track.scrollWidth <= track.clientWidth + 4) return;

      const forward = isRtl ? "ArrowLeft" : "ArrowRight";
      const backward = isRtl ? "ArrowRight" : "ArrowLeft";

      if (event.key === forward) {
        event.preventDefault();
        moveRail("next");
      } else if (event.key === backward) {
        event.preventDefault();
        moveRail("prev");
      } else if (event.key === "Home") {
        event.preventDefault();
        moveRail("first");
      } else if (event.key === "End") {
        event.preventDefault();
        moveRail("last");
      }
    },
    [isRtl, moveRail],
  );

  return (
    <section className="overflow-hidden bg-bun-paper py-20 sm:py-24 lg:py-12" data-horizontal-gallery="">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <div className="max-w-2xl" data-reveal-group="">
            <p className="section-kicker" data-reveal-item="">
              {t("home.featuredKicker")}
            </p>
            {/* در دسکتاپ تیتر کمی جمع‌تر می‌شود تا کارت‌ها کامل در فریم پین‌شده جا شوند. */}
            <MotionText
              text={t("home.featuredTitle")}
              className="section-title mt-3 lg:text-[clamp(2.25rem,3.6vw,3.25rem)]"
            />
            <p className="section-copy mt-4" data-reveal-item="">
              {t("home.featuredDescription")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 lg:justify-end lg:pb-1" data-reveal-group="">
            <p className="text-xs font-bold text-bun-muted" data-reveal-item="">
              {t("home.featuredHint")}
            </p>
            <Link
              to="/menu"
              data-magnetic="0.16"
              data-cursor-label={t("common.viewMenu")}
              data-reveal-item=""
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shrink-0")}
            >
              {t("common.viewMenu")}
              <ArrowRight className={cn("size-4", isRtl && "rotate-180")} aria-hidden="true" />
            </Link>
          </div>
        </div>

        {!hasItems && status !== "loading" ? (
          <FeaturedRailNote>
            {status === "error" ? t("home.featuredError") : t("home.featuredEmpty")}
          </FeaturedRailNote>
        ) : null}

        <div
          ref={trackRef}
          data-horizontal-track=""
          data-reveal-group=""
          role="group"
          aria-roledescription={t("home.featuredRailRole")}
          aria-label={t("home.featuredTitle")}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 outline-none focus-visible:ring-2 focus-visible:ring-bun-gold focus-visible:ring-offset-2 focus-visible:ring-offset-bun-paper lg:mt-10 lg:w-max lg:gap-8 lg:overflow-visible lg:pb-0"
        >
          {hasItems ? (
            items.map((item, index) => (
              <FeaturedCard key={item.id} item={item} index={index} register={registerCard} />
            ))
          ) : (
            <FeaturedRailPlaceholders pulsing={status === "loading"} />
          )}
          <FeaturedRailEndCard />
        </div>
      </div>
    </section>
  );
}

