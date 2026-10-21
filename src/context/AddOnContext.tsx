import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import type { LocalizedText } from "@/types";

/**
 * پنل «مخلفات پیشنهادی» (Smart Add-ons).
 *
 * بعد از افزودن موفق یک غذا، این پنل باز می‌شود تا مشتری نوشیدنی/ساید مرتبط را
 * — اختیاری — به همان سفارش اضافه کند. state پنل بیرون از کامپوننت‌های دکمه
 * نگه داشته می‌شود تا:
 *
 *   1. هر دکمه «افزودن به سبد» سایت (کارت منو، صفحه محصول، ریل پرطرفدارها) و
 *      کشوی سبد بتوانند همان پنل را باز کنند،
 *   2. پنل روی هر مسیری در دسترس باشد (داخل `Layout` سوار می‌شود).
 *
 * قاعده ضد‌مزاحمت: هر سطر سبد در یک نشست فقط **یک‌بار** پیشنهاد می‌گیرد. افزودن
 * دوبارهٔ همان غذا (برای زیاد‌کردن تعداد) پنل را باز نمی‌کند و کسی که یک‌بار
 * «ادامه بدون مخلفات» را زده، دوباره سؤال نمی‌شود. باز کردن دستی از سبد همیشه
 * ممکن است (`open`).
 */
export interface AddOnTarget {
  /** کلید سطر غذای اصلی در سبد (`CartLine.key`). */
  lineKey: string;
  /** شناسه منو (slug یا cuid) برای خواندن فهرست مخلفات از API. */
  itemId: string;
  /** نام غذا؛ در تیتر پنل استفاده می‌شود. */
  name: LocalizedText;
}

interface AddOnPanelValue {
  /** غذایی که پنل برایش باز است؛ `null` یعنی پنل بسته است. */
  target: AddOnTarget | null;
  /** پیشنهاد خودکار پس از افزودن غذا؛ اگر قبلاً پیشنهاد شده باشد بی‌اثر است. */
  offer: (target: AddOnTarget) => void;
  /** باز کردن دستی پنل (از کشوی سبد). */
  open: (target: AddOnTarget) => void;
  close: () => void;
}

const AddOnPanelContext = createContext<AddOnPanelValue | null>(null);

export function AddOnPanelProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<AddOnTarget | null>(null);
  /** سطرهایی که در همین نشست پیشنهاد گرفته‌اند (ضد‌مزاحمت). */
  const offered = useRef<Set<string>>(new Set());

  const open = useCallback((next: AddOnTarget) => {
    offered.current.add(next.lineKey);
    setTarget(next);
  }, []);

  const offer = useCallback(
    (next: AddOnTarget) => {
      if (offered.current.has(next.lineKey)) return;
      open(next);
    },
    [open],
  );

  const close = useCallback(() => setTarget(null), []);

  const value = useMemo<AddOnPanelValue>(
    () => ({ target, offer, open, close }),
    [target, offer, open, close],
  );

  return <AddOnPanelContext value={value}>{children}</AddOnPanelContext>;
}

export function useAddOnPanel(): AddOnPanelValue {
  const context = use(AddOnPanelContext);
  if (!context) throw new Error("useAddOnPanel must be used within AddOnPanelProvider");
  return context;
}