import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/hooks/useLanguage";

/**
 * کپچای Cloudflare Turnstile.
 *
 * اسکریپت فقط وقتی لود می‌شود که این کامپوننت واقعاً نمایش داده شود (بعد از
 * چند تلاش ناموفق)، پس روی سرعت بارگذاری اولیه سایت اثری ندارد.
 *
 * توکن‌های کپچا یک‌بارمصرف‌اند؛ والد با تغییر `resetKey` ویجت را ریست می‌کند.
 */

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const env = (import.meta as unknown as { env?: Record<string, string | boolean | undefined> }).env;
const SITE_KEY = typeof env?.VITE_TURNSTILE_SITE_KEY === "string" ? env.VITE_TURNSTILE_SITE_KEY : "";
const IS_DEV = env?.DEV === true;

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      script.remove();
      reject(new Error("captcha-load-failed"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface CaptchaProps {
  /** با توکن معتبر صدا زده می‌شود؛ با رشته خالی وقتی توکن منقضی یا ناموفق شد. */
  onToken: (token: string) => void;
  /** با تغییر این عدد، ویجت دوباره ساخته می‌شود. */
  resetKey?: number;
}

export function Captcha({ onToken, resetKey = 0 }: CaptchaProps) {
  const language = useLanguage();
  const fa = language === "fa";
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    setFailed(false);
    onTokenRef.current("");
    loadScript()
      .then(() => {
        if (cancelled || !box.current) return;
        if (!window.turnstile) throw new Error("captcha-load-failed");
        widgetId.current = window.turnstile.render(box.current, {
          sitekey: SITE_KEY,
          language: fa ? "fa" : "en",
          callback: (token: string) => { if (!cancelled) onTokenRef.current(token); },
          "expired-callback": () => { if (!cancelled) onTokenRef.current(""); },
          "error-callback": () => { if (!cancelled) { onTokenRef.current(""); setFailed(true); } },
        });
      })
      .catch(() => { if (!cancelled) { onTokenRef.current(""); setFailed(true); } });
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = undefined;
    };
  }, [fa, retry]);

  useEffect(() => {
    if (resetKey > 0 && widgetId.current) window.turnstile?.reset(widgetId.current);
  }, [resetKey]);

  if (!SITE_KEY) {
    // فقط در توسعه: بک‌اند در حالت mock توکن «mock-captcha-ok» را می‌پذیرد.
    return IS_DEV ? (
      <Button type="button" variant="secondary" onClick={() => onToken("mock-captcha-ok")}>
        {fa ? "کپچای آزمایشی (فقط توسعه)" : "Mock captcha (dev only)"}
      </Button>
    ) : (
      <p role="alert" className="text-xs font-bold text-bun-red">
        {fa ? "کپچا پیکربندی نشده است. با ما تماس بگیرید." : "Captcha is not configured. Please contact us."}
      </p>
    );
  }

  return <div className="space-y-2">
    <div ref={box} dir="ltr" />
    {failed && <>
      <p role="alert" className="text-xs font-bold text-bun-red">{fa ? "بارگذاری کپچا ناموفق بود. دوباره تلاش کنید." : "Captcha could not load. Please try again."}</p>
      <Button type="button" variant="secondary" onClick={() => setRetry(value => value + 1)}>{fa ? "تلاش دوباره برای کپچا" : "Retry captcha"}</Button>
    </>}
  </div>;
}
