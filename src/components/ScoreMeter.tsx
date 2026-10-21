import { useTranslation } from "react-i18next";

export function ScoreMeter({ score }: { score: number }) {
  const { t } = useTranslation();
  return (
    <div className="text-center">
      <div
        data-reveal="scale"
        className="relative mx-auto grid size-36 place-items-center rounded-full p-3"
        style={{ background: `conic-gradient(var(--bun-orange) ${score * 10}%, var(--bun-line) 0)` }}
      >
        <div className="grid size-full place-items-center rounded-full bg-bun-paper">
          <div><span className="font-display text-4xl font-black text-bun-text">{score}</span><span className="text-sm font-bold text-bun-muted">/10</span></div>
        </div>
      </div>
      <p className="mt-4 text-sm font-black uppercase tracking-[0.12em] text-bun-muted">{t("product.score")}</p>
    </div>
  );
}