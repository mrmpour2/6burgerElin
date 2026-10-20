import { ArrowLeft, Clock3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { MotionText } from "@/components/MotionText";
import { ResponsiveImage } from "@/components/ResponsiveImage";
import { buttonVariants } from "@/components/ui/Button";
import { blogPostById } from "@/data/content";
import { useLanguage } from "@/hooks/useLanguage";

export default function BlogPostPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const language = useLanguage();
  const post = id ? blogPostById.get(id) : undefined;

  if (!post) {
    return (
      <section className="grid min-h-[70vh] place-items-center bg-bun-paper px-4 pt-24 text-center">
        <div><h1 className="section-title">{t("notFound.title")}</h1><Link to="/blog" className={buttonVariants({ className: "mt-6" })}>{t("blog.back")}</Link></div>
      </section>
    );
  }

  return (
    <article className="bg-bun-paper pb-20 pt-28 sm:pb-28 sm:pt-36">
      <header className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <Link to="/blog" className={buttonVariants({ variant: "ghost", size: "sm", className: "px-0" })}>
          <ArrowLeft className={`size-4 ${language === "fa" ? "rotate-180" : ""}`} aria-hidden="true" /> {t("blog.back")}
        </Link>
        <div data-reveal-group="">
          <p className="mt-10 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-bun-muted" data-reveal-item="">
            {post.date[language]} <span>·</span> <Clock3 className="size-3.5" aria-hidden="true" /> {post.readTime} {t("common.minutes")}
          </p>
          <MotionText
            as="h1"
            text={post.title[language]}
            className="mt-5 font-display text-[clamp(2.8rem,8vw,6rem)] font-black leading-[0.94] tracking-[-0.06em] text-bun-text"
          />
          <p className="mt-6 max-w-2xl text-lg leading-8 text-bun-muted" data-reveal-item="">{post.excerpt[language]}</p>
        </div>
      </header>
      <div className="mx-auto mt-12 max-w-7xl px-4 sm:px-6 lg:px-8">
        <ResponsiveImage
          src={post.image}
          alt={post.imageAlt[language]}
          eager
          sizes="100vw"
          className="aspect-[16/8] rounded-[2rem] bg-bun-surface"
          reveal
          parallax={0.1}
        />
      </div>
      <div className="prose-bun mx-auto mt-12 max-w-3xl px-4 sm:px-6 lg:px-8" data-reveal-group="">
        {post.body[language].map((paragraph) => <p key={paragraph} data-reveal-item="">{paragraph}</p>)}
      </div>
    </article>
  );
}