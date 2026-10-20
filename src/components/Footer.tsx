import { Camera, MapPin, Navigation, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LazyMount } from "@/components/LazyMount";
import { instagramAccounts, storeLocation, storePhone } from "@/data/content";
import { useLanguage } from "@/hooks/useLanguage";


/**
 * فوتر سایت.
 *
 * نشانی‌ها همه از `src/data/content.ts` می‌آیند (نه هاردکد)، تا تغییر حساب
 * اینستاگرام یا مکان مغازه فقط یک جا انجام شود.
 */
export function Footer() {
  const { t } = useTranslation();
  const language = useLanguage();
  return (
    <footer className="border-t border-bun-line bg-bun-surface py-12 sm:py-16">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.3fr_0.9fr_1.1fr_1.2fr] lg:px-8">
        <div>
          <Link to="/" className="inline-flex items-baseline gap-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-bun-gold">
            <span className="font-display text-3xl font-black tracking-[-0.08em]">6</span>
            <span className="font-display text-xl font-black text-bun-accent">burgerElin</span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-7 text-bun-muted">{t("footer.tagline")}</p>

          <h2 className="mt-8 text-sm font-black uppercase tracking-[0.16em] text-bun-text">
            {t("footer.follow")}
          </h2>
<div className="mt-4 flex items-start gap-3 text-sm">
  {instagramAccounts.map((account) => {
    const Icon = account.icon;
    return (
      <a
        key={account.url}
        href={account.url}
        target="_blank"
        rel="noreferrer"
        aria-label={account.label[language]}
        className="inline-flex items-center gap-2 font-bold text-bun-muted hover:text-bun-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bun-gold"
      >
        <Icon className="h-8 w-auto" aria-hidden="true" />
        {account.handle}
      </a>
    );
  })}
          </div>
          <p className="mt-3 max-w-xs text-xs leading-6 text-bun-muted">{t("footer.instagramHint")}</p>
        </div>
        <div>
          <h2 className="text-sm font-black uppercase tracking-[0.16em] text-bun-text">{t("footer.quickLinks")}</h2>
          <div className="mt-4 flex flex-col items-start gap-3 text-sm font-medium text-bun-muted">
            <Link className="hover:text-bun-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bun-gold" to="/menu">{t("nav.menu")}</Link>
            <Link className="hover:text-bun-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bun-gold" to="/checkout">{t("cart.title")}</Link>
            <Link className="hover:text-bun-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bun-gold" to="/loyalty">{t("nav.loyalty")}</Link>
            <Link className="hover:text-bun-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bun-gold" to="/blog">{t("nav.blog")}</Link>
          </div>
        </div>
        <div>
          <h2 className="text-sm font-black uppercase tracking-[0.16em] text-bun-text">{t("footer.contact")}</h2>
          <div className="mt-4 flex flex-col gap-3 text-sm text-bun-muted">
            <a href={`tel:${storePhone}`} className="inline-flex items-center gap-2 hover:text-bun-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bun-gold">
              <Phone className="size-4" aria-hidden="true" /> {t("footer.phone")}
            </a>
            <a href={storeLocation.placeUrl} target="_blank" rel="noreferrer" className="inline-flex items-start gap-2 hover:text-bun-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bun-gold">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {t("home.address")}
            </a>
            <a href={storeLocation.directionsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-bold hover:text-bun-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bun-gold">
              <Navigation className="size-4" aria-hidden="true" /> {t("footer.directions")}
            </a>
          </div>
        </div>
        <div>
          <h2 className="text-sm font-black uppercase tracking-[0.16em] text-bun-text">{t("footer.location")}</h2>
          {/* نقشه فقط وقتی وارد دید کاربر شد بارگذاری می‌شود؛ iframe روی هر مسیری
              در DOM فوتر هست و بارگذاری زودهنگام آن هزینه بی‌دلیل است. */}
          <LazyMount minHeight={208}>
            <div className="mt-4 overflow-hidden rounded-2xl border border-bun-line bg-bun-paper">
              <iframe
                title={t("footer.mapTitle")}
                src={storeLocation.embedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-52 w-full border-0"
              />
            </div>
          </LazyMount>
          <a
            href={storeLocation.placeUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-xs font-bold text-bun-accent underline decoration-bun-line underline-offset-4 hover:text-bun-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bun-gold"
          >
            {t("footer.openInMaps")}
          </a>
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-2 border-t border-bun-line px-4 pt-6 text-xs text-bun-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>© 2026 {t("footer.copyright")}</p>
        <p>{t("footer.credit")}</p>
      </div>
    </footer>
  );
}