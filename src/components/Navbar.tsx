import { Menu, Moon, ShoppingBag, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/Button";
import type { TranslationKey } from "@/i18n";
import { cn } from "@/utils/cn";

/** Labels stay literal-key typed so `t(link.label)` type-checks against the locales. */
const links: ReadonlyArray<{ to: string; label: TranslationKey }> = [
  { to: "/", label: "nav.home" },
  { to: "/menu", label: "nav.menu" },
  { to: "/loyalty", label: "nav.loyalty" },
  { to: "/blog", label: "nav.blog" },
];

export function Navbar() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { count, openCart } = useCart();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const hasLightPageTop = /^\/(menu|blog)\/[^/]+/.test(location.pathname);
  const transparent = !scrolled && !open && !hasLightPageTop;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const switchLanguage = () => {
    const next = i18n.resolvedLanguage?.startsWith("fa") ? "en" : "fa";
    void i18n.changeLanguage(next);
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow] duration-300",
        transparent
          ? "bg-gradient-to-b from-black/50 to-transparent text-white"
          : "border-b border-bun-line bg-bun-paper/88 shadow-sm backdrop-blur-xl",
      )}
    >
      <nav className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Primary navigation">
        <NavLink
          to="/"
          className="group inline-flex items-baseline gap-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-bun-gold"
          aria-label="شیش برگر الین home"
        >
          <span className="font-display text-2xl font-black tracking-[-0.08em]">6Burger</span>
          <span className={cn("font-display text-lg font-black", transparent ? "text-bun-orange" : "text-bun-accent")}>Elin</span>
        </NavLink>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                cn(
                  "rounded-full px-4 py-2 text-sm font-bold outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-bun-gold",
                  isActive ? (transparent ? "text-bun-orange" : "text-bun-accent") : "text-current/80",
                )
              }
            >
              {t(link.label)}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={switchLanguage}
            aria-label={`Switch language to ${t("nav.language")}`}
            className={cn("px-3", transparent && "text-white hover:bg-white/10 hover:text-white")}
          >
            {t("nav.language")}
          </Button>
          <Button
            variant="icon"
            size="icon"
            onClick={toggleTheme}
            aria-label={t("nav.theme")}
            aria-pressed={theme === "dark"}
            className={cn(transparent && "text-white hover:bg-white/10 hover:text-bun-gold")}
          >
            {theme === "dark" ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
          </Button>
          <Button
            variant="icon"
            size="icon"
            onClick={openCart}
            aria-label={count > 0 ? t("nav.cartWithCount", { count }) : t("nav.cart")}
            className={cn("relative", transparent && "text-white hover:bg-white/10 hover:text-bun-gold")}
          >
            <ShoppingBag className="size-5" aria-hidden="true" />
            {count > 0 ? (
              <span className="absolute end-0.5 top-0.5 grid min-w-5 place-items-center rounded-full bg-bun-orange px-1 text-[10px] font-black leading-5 text-bun-ink ring-2 ring-bun-paper/70">
                {count > 99 ? "99+" : count}
              </span>
            ) : null}
          </Button>
          <Button
            variant="icon"
            size="icon"
            className={cn("md:hidden", transparent && "text-white hover:bg-white/10 hover:text-bun-gold")}
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </Button>
        </div>
      </nav>

      {open ? (
        <div id="mobile-navigation" className="border-t border-bun-line bg-bun-paper px-4 py-4 text-bun-text md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "rounded-xl px-4 py-3 text-base font-bold outline-none hover:bg-bun-text/6 focus-visible:ring-2 focus-visible:ring-bun-gold",
                    isActive && "bg-bun-orange/10 text-bun-accent",
                  )
                }
              >
                {t(link.label)}
              </NavLink>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}