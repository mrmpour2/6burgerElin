import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MenuCard } from "@/components/MenuCard";
import { PageIntro } from "@/components/PageIntro";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { menuItems, mergeCatalogItems } from "@/data/content";
import { usePublicMenu } from "@/hooks/usePublicMenu";
import type { MenuCategory } from "@/types";
import { cn } from "@/utils/cn";

const categories: MenuCategory[] = ["burgers", "pizza", "sides", "drinks", "combos"];

export default function MenuPage() {
  const { t } = useTranslation();
  const [active, setActive] = useState<MenuCategory>("burgers");
  const { items: liveItems, status } = usePublicMenu();

  /**
   * کاتالوگ ثابت + آیتم‌های زنده پنل. آیتم‌های ثابت اول می‌آیند (تصویر و متن
   * تأییدشده) و آیتم هم‌نام دیتابیس حذف می‌شود تا یک غذا دو بار دیده نشود.
   */
  const items = useMemo(
    () => mergeCatalogItems(menuItems, liveItems).filter((item) => item.category === active),
    [liveItems, active],
  );

  return (
    <>
      <PageIntro
        kicker={t("menuPage.kicker")}
        title={t("menuPage.title")}
        description={t("menuPage.description")}
      />
      <section className="bg-bun-paper py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {status === "error" ? (
            <p
              role="status"
              className="mb-8 rounded-2xl border border-bun-line bg-bun-surface px-4 py-3 text-sm font-bold text-bun-muted"
            >
              {t("menuPage.offline")}
            </p>
          ) : null}
          <div
            className="overflow-x-auto border-b border-bun-line"
            role="tablist"
            aria-label={t("nav.menu")}
          >
            <div className="flex min-w-max gap-7 sm:gap-10">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  role="tab"
                  aria-selected={active === category}
                  aria-controls="menu-panel"
                  onClick={() => setActive(category)}
                  className={cn(
                    "relative cursor-pointer px-0 pb-4 text-sm font-black outline-none transition-colors focus-visible:text-bun-accent focus-visible:ring-2 focus-visible:ring-bun-gold",
                    active === category ? "text-bun-text" : "text-bun-muted hover:text-bun-accent"
                  )}
                >
                  {t(`menuPage.categories.${category}`)}
                  {active === category ? (
                    <motion.span
                      layoutId="menu-active"
                      className="absolute inset-x-0 bottom-0 h-0.5 bg-bun-orange"
                      transition={{ duration: 0.22 }}
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              id="menu-panel"
              key={active}
              role="tabpanel"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28 }}
              className="mt-12"
            >
              {status === "loading" && items.length === 0 ? (
                <SkeletonLoader />
              ) : (
                <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
                  {items.length ? (
                    items.map((item) => <MenuCard key={item.id} item={item} />)
                  ) : (
                    <p className="col-span-full text-center text-bun-muted">
                      {t("menuPage.empty")}
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </>
  );
}
