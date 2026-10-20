import { useEffect, useState } from "react";
import { fetchPublicMenu, peekPublicMenu } from "@/api/menu";
import type { MenuItem } from "@/types";

export interface PublicMenuState {
  /** آیتم‌های زنده بک‌اند (خالی وقتی درخواست در جریان است یا شکست خورده). */
  items: MenuItem[];
  /**
   * `loading` تا رسیدن اولین پاسخ، `ready` وقتی داده داریم و
   * `error` وقتی API در دسترس نیست (صفحه‌ها کاتالوگ ثابت را نشان می‌دهند).
   */
  status: "loading" | "ready" | "error";
}

/**
 * فهرست منوی زنده را از `/api/public/menu` می‌خواند.
 *
 * درخواست داخل `@/api/menu` کش می‌شود، پس چند کامپوننت/صفحه یعنی یک درخواست.
 * اگر پاسخ قبلاً رسیده باشد، وضعیت از همان ابتدا `ready` است تا هنگام
 * جابه‌جایی بین صفحه‌ها فلش لودینگ نبینیم.
 */
export function usePublicMenu(): PublicMenuState {
  const [state, setState] = useState<PublicMenuState>(() => {
    const cached = peekPublicMenu();
    return cached ? { items: cached, status: "ready" } : { items: [], status: "loading" };
  });

  useEffect(() => {
    if (state.status === "ready") return;

    let active = true;

    fetchPublicMenu()
      .then((items) => {
        if (active) setState({ items, status: "ready" });
      })
      .catch(() => {
        if (active) setState({ items: [], status: "error" });
      });

    return () => {
      active = false;
    };
    // فقط یک‌بار در هر mount؛ `state.status` عمداً در وابستگی‌ها نیست تا با
    // تغییر وضعیت، درخواست دوباره فرستاده نشود.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
