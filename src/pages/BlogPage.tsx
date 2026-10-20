import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { PageIntro } from "@/components/PageIntro";
import { ResponsiveImage } from "@/components/ResponsiveImage";
import { buttonVariants } from "@/components/ui/Button";
import { blogPosts } from "@/data/content";
import { useLanguage } from "@/hooks/useLanguage";

export default function BlogPage() {
  const { t } = useTranslation();
  const language = useLanguage();
  return (
    <>
      <PageIntro kicker={t("blog.kicker")} title={t("blog.title")} description={t("blog.description")} />
      <section className="bg-bun-paper py-16 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-x-8 gap-y-14 px-4 sm:grid-cols-2 sm:px-6 lg:px-8" data-reveal-group="">
          {blogPosts.map((post, index) => (
            <article key={post.id} className={index === 0 ? "sm:col-span-2" : ""} data-reveal-item="">
              <Link
                to={`/blog/${post.id}`}
                className={`group grid gap-6 rounded-[1.75rem] outline-none focus-visible:ring-2 focus-visible:ring-bun-gold focus-visible:ring-offset-4 focus-visible:ring-offset-bun-paper ${index === 0 ? "lg:grid-cols-[1.25fr_.75fr] lg:items-center" : ""}`}
              >
                <ResponsiveImage
                  src={post.image}
                  alt={post.imageAlt[language]}
                  eager={index === 0}
                  sizes={index === 0 ? "(max-width: 1024px) 100vw, 65vw" : "(max-width: 640px) 100vw, 50vw"}
                  className={`bg-bun-surface ${index === 0 ? "aspect-[16/9]" : "aspect-[16/10]"} rounded-[1.75rem]`}
                  imageClassName="transition-transform duration-500 group-hover:scale-[1.035]"
                  reveal
                />
                <div className={index === 0 ? "lg:p-4" : "px-1"}>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-bun-muted">{post.date[language]} · {post.readTime} {t("common.minutes")}</p>
                  <h2 className={`mt-3 font-display font-black leading-tight text-bun-text ${index === 0 ? "text-3xl sm:text-5xl" : "text-2xl sm:text-3xl"}`}>{post.title[language]}</h2>
                  <p className="mt-4 text-sm leading-7 text-bun-muted">{post.excerpt[language]}</p>
                  <span className={buttonVariants({ variant: "ghost", size: "sm", className: "mt-4 px-0 group-hover:text-bun-accent" })}>
                    {t("common.readMore")}
                    <ArrowRight className={`size-4 ${language === "fa" ? "rotate-180" : ""}`} aria-hidden="true" />
                  </span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}