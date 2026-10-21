import { useCallback, useEffect, useState } from "react";
import {
  fetchTableTalk,
  peekTableTalk,
  refreshTableTalk,
  type TableTalkFeed,
} from "@/api/testimonials";

export interface TableTalkState {
  /** روایت‌های آمادهٔ نمایش (خالی در حال بارگذاری یا خطا). */
  items: TableTalkFeed["items"];
  /**
   * `loading` تا رسیدن اولین پاسخ، `ready` وقتی داده داریم (حتی فهرست خالی) و
   * `error` وقتی API در دسترس نیست.
   */
  status: "loading" | "ready" | "error";
  /** تلاش دوباره پس از خطا؛ کش را پاک می‌کند و درخواست تازه می‌زند. */
  retry: () => void;
}

/**
 * روایت‌های بخش «Table Talk» را از `/api/public/testimonials` می‌خواند.
 *
 * درخواست داخل `@/api/testimonials` کش می‌شود، پس چند بازدید از صفحهٔ اصلی یعنی
 * یک درخواست. اگر پاسخ قبلاً رسیده باشد وضعیت از همان ابتدا `ready` است تا هنگام
 * جابه‌جایی صفحه فلش لودینگ نبینیم.
 */
export function useTableTalk(): TableTalkState {
  const [state, setState] = useState<{ items: TableTalkFeed["items"]; status: TableTalkState["status"] }>(
    () => {
      const cached = peekTableTalk();
      return cached ? { items: cached.items, status: "ready" } : { items: [], status: "loading" };
    },
  );
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (state.status === "ready") return;

    let active = true;
    const load = reloadKey === 0 ? fetchTableTalk : refreshTableTalk;

    load()
      .then((feed) => {
        if (active) setState({ items: feed.items, status: "ready" });
      })
      .catch(() => {
        if (active) setState({ items: [], status: "error" });
      });

    return () => {
      active = false;
    };
    // `state.status` عمداً در وابستگی‌ها نیست؛ فقط تغییر `reloadKey` (دکمهٔ
    // تلاش دوباره) باید درخواست تازه بفرستد.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const retry = useCallback(() => {
    setState({ items: [], status: "loading" });
    setReloadKey((key) => key + 1);
  }, []);

  return { items: state.items, status: state.status, retry };
}
