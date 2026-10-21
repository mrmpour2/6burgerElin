import { memo } from "react";
import { ArrowRight, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AddToCartButton } from "@/components/AddToCartButton";
import { MenuItemImage } from "@/components/MenuItemImage";
import { formatPrice, hasVariants, itemVariants, priceRange } from "@/data/content";
import { useLanguage } from "@/hooks/useLanguage";
import type { MenuItem } from "@/types";
import { buttonVariants } from "@/components/ui/Button";

export const MenuCard = memo(function MenuCard({ item }: { item: MenuItem }) {
  const { t } = useTranslation();
  const language = useLanguage();
  // آیتم دارای سایز، قیمت «از» را نشان می‌دهد تا کاربر بداند ارزان‌ترین سایز چند است.
  const from = priceRange(item).min;

  return (
    <article className="group flex h-full flex-col">
      <Link
        to={`/menu/${item.id}`}
        data-cursor-label={t("common.viewDetails")}
        className="relative block aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-bun-surface outline-none ring-bun-gold focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:ring-offset-bun-paper"
        aria-label={`${t("common.viewDetails")}: ${item.name[language]}`}
      >
        <MenuItemImage
          item={item}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="h-full w-full"
          imageClassName="transition-transform duration-500 ease-out group-hover:scale-[1.045]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/42 via-transparent to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-90" />
        <span className="absolute bottom-4 end-4 rounded-full bg-black/65 px-3 py-1.5 text-sm font-black text-white backdrop-blur-md">
          {hasVariants(item)
            ? t("product.from", { price: formatPrice(from, language) })
            : formatPrice(item.price, language)}
        </span>
        {item.available === false ? (
          <span className="absolute bottom-4 start-4 rounded-full bg-bun-ink/85 px-3 py-1.5 text-xs font-black text-white backdrop-blur-md">
            {t("menuPage.unavailable")}
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col px-1 pb-2 pt-5">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-xl font-black tracking-tight text-bun-text">
            {item.name[language]}
          </h3>
          {item.rating === undefined ? null : (
            <span className="inline-flex shrink-0 items-center gap-1 pt-1 text-sm font-bold text-bun-text">
              <Star className="size-4 fill-bun-gold text-bun-gold" aria-hidden="true" />
              <span>{item.rating}</span>
            </span>
          )}
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-bun-muted">
          {item.description[language]}
        </p>
        {hasVariants(item) ? (
          <p className="mt-2 text-xs font-bold text-bun-accent">
            {itemVariants(item)
              .map((candidate) => candidate.label[language])
              .join(" · ")}
          </p>
        ) : null}
        <div className="mt-4 flex items-center justify-between gap-3">
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
              className={`size-4 ${language === "fa" ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </Link>
          <AddToCartButton item={item} size="sm" variant="secondary" showUnavailableHint={false} />
        </div>
      </div>
    </article>
  );
});