import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { buttonVariants } from "@/components/ui/Button";

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <section className="grid min-h-[78vh] place-items-center bg-gradient-to-br from-bun-ink via-bun-burgundy to-bun-red px-4 pt-20 text-center text-white">
      <div>
        <p className="font-display text-8xl font-black text-bun-orange">404</p>
        <h1 className="mt-5 font-display text-4xl font-black sm:text-6xl">{t("notFound.title")}</h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-white/70">{t("notFound.text")}</p>
        <Link to="/" className={buttonVariants({ size: "lg", className: "mt-8" })}>{t("notFound.action")}</Link>
      </div>
    </section>
  );
}