import axios from "axios";

/**
 * آدرس پایه API مشترک (بک‌اند Express در `dashboard/backend`).
 *
 * پیش‌فرض مسیر نسبی `/api` است تا درخواست‌ها در توسعه از پروکسی Vite
 * (`vite.config.ts` → `server.proxy`) و در تولید از reverse proxy همان دامنه
 * عبور کنند؛ این‌طور CORS و اختلاف origin پیش نمی‌آید. برای اتصال مستقیم به یک
 * origin دیگر، `VITE_API_BASE_URL` را در `.env` ست کنید
 * (مثلاً `http://localhost:5000` یا `https://api.شیش برگر الین.ir`).
 */
const envBaseUrl =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL ?? "";

/**
 * اگر انتهای مقدار `/api` نباشد اضافه می‌شود، تا مسیرهای نسبی مثل
 * `/public/menu` در هر دو حالت (مقدار خالی یا origin کامل) درست ساخته شوند.
 */
function toApiBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "/api";
  return /\/api$/i.test(trimmed) ? trimmed : `${trimmed}/api`;
}

export const apiBaseUrl = toApiBaseUrl(envBaseUrl);

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});
