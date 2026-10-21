import { useTranslation } from "react-i18next";

export function PageLoader() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status">
      <div className="flex items-center gap-3 text-sm font-bold text-bun-muted">
        <span className="size-2 animate-pulse rounded-full bg-bun-orange" />
        <span>{t("common.loading")}</span>
      </div>
    </div>
  );
}