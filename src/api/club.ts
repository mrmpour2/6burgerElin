import { isAxiosError } from "axios";
import { apiClient } from "./client";
import type {
  ClubDashboard,
  ClubMember,
  ClubRedemption,
  ClubRedemptionResult,
  ClubReward,
  ClubRewardReason,
  ClubTierId,
  ClubTransaction,
} from "@/types";

/**
 * لایهٔ باشگاه مشتریان در وب‌سایت.
 *
 * قرارداد با بک‌اند (`dashboard/backend/src/routes/clubRoutes.js`):
 *
 *   GET  /api/public/club/rewards              → { rewards: ClubReward[] }
 *   POST /api/public/club/join                 ← { name, phone, pin }
 *                                               → { member: ClubMember }
 *   POST /api/public/club/login                ← { phone, pin }
 *                                               → { member: ClubMember }
 *   POST /api/public/club/logout               → 204
 *   GET  /api/public/club/me                   → ClubDashboard
 *   POST /api/public/club/rewards/:id/redeem   ← { idempotencyKey }
 *                                               → ClubRedemptionResult
 *
 * احراز هویت با کوکی HttpOnly است، پس هر درخواستِ حساب با
 * `withCredentials: true` فرستاده می‌شود. هیچ امتیاز/سطحی این‌جا محاسبه نمی‌شود؛
 * پاسخ سرور تنها منبع حقیقت است.
 */

const CLUB_BASE = "/public/club";

/** درخواست‌هایی که کوکی عضویت را می‌خوانند یا می‌نویسند. */
const WITH_COOKIE = { withCredentials: true } as const;

export interface ClubJoinInput {
  /** نام نمایشی؛ سرور حداقل ۲ نویسه می‌خواهد. */
  name: string;
  phone: string;
  /** ۴ تا ۸ رقم؛ ارقام فارسی/عربی هم پذیرفته می‌شوند. */
  pin: string;
}

export interface ClubLoginInput {
  phone: string;
  pin: string;
}

/** خطای لایهٔ باشگاه با کد وضعیت HTTP تا رابط کاربری پیام درست را انتخاب کند. */
export class ClubApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 0, code = "CLUB_API_ERROR") {
    super(message);
    this.name = "ClubApiError";
    this.status = status;
    this.code = code;
  }
}

export function isClubApiError(error: unknown): error is ClubApiError {
  return error instanceof ClubApiError;
}

/** `true` اگر خطا از نوع «کوکی نداریم/منقضی شده» باشد. */
export function isClubUnauthorized(error: unknown): boolean {
  return isClubApiError(error) && error.status === 401;
}

/** هر خطای axios (یا شکل ناشناخته) را به یک `ClubApiError` قابل‌تشخیص تبدیل می‌کند. */
function toClubApiError(error: unknown): ClubApiError {
  if (isClubApiError(error)) return error;

  if (isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const data = error.response?.data as { message?: unknown; code?: unknown } | undefined;
    const message =
      typeof data?.message === "string" && data.message.trim()
        ? data.message
        : status === 0
          ? "ارتباط با سرور برقرار نشد."
          : "درخواست باشگاه انجام نشد.";
    const code =
      typeof data?.code === "string" && data.code.trim() ? data.code : "CLUB_API_ERROR";
    return new ClubApiError(message, status, code);
  }

  return new ClubApiError("پاسخ سرور قابل خواندن نبود.", 0, "CLUB_BAD_RESPONSE");
}

async function run<T>(request: Promise<{ data: T }>): Promise<T> {
  try {
    const response = await request;
    return response.data;
  } catch (error) {
    throw toClubApiError(error);
  }
}

/* -------------------------------------------------------------------------- */
/* نرمال‌سازی پاسخ سرور                                                       */
/* -------------------------------------------------------------------------- */

const TIER_IDS: readonly ClubTierId[] = ["bronze", "silver", "gold"];

const REWARD_REASONS: readonly ClubRewardReason[] = [
  "ok",
  "inactive",
  "expired",
  "out_of_stock",
  "login_required",
  "tier_required",
  "insufficient_points",
];

function badResponse(): never {
  throw new ClubApiError("پاسخ سرور قابل خواندن نبود.", 0, "CLUB_BAD_RESPONSE");
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) badResponse();
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== "string") badResponse();
  return value;
}

function nullableText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return text(value);
}

function number(value: unknown, { integer = false } = {}): number {
  if (typeof value !== "number" || !Number.isFinite(value)) badResponse();
  if (integer && !Number.isInteger(value)) badResponse();
  return value;
}

function nullableNumber(value: unknown, options: { integer?: boolean } = {}): number | null {
  if (value === null || value === undefined) return null;
  return number(value, options);
}

function tierId(value: unknown): ClubTierId {
  const id = text(value);
  if (!TIER_IDS.includes(id as ClubTierId)) badResponse();
  return id as ClubTierId;
}

function rewardReason(value: unknown): ClubRewardReason {
  const reason = text(value);
  if (!REWARD_REASONS.includes(reason as ClubRewardReason)) badResponse();
  return reason as ClubRewardReason;
}


function parseMember(value: unknown): ClubMember {
  const raw = record(value);
  const tier = record(raw.tier);
  return {
    id: text(raw.id),
    name: text(raw.name),
    phone: text(raw.phone),
    points: number(raw.points, { integer: true }),
    joinedAt: text(raw.joinedAt),
    lastLoginAt: nullableText(raw.lastLoginAt),
    tier: {
      id: tierId(tier.id),
      threshold: number(tier.threshold, { integer: true }),
      nextTier: tier.nextTier === null ? null : tierId(tier.nextTier),
      nextThreshold: nullableNumber(tier.nextThreshold, { integer: true }),
      pointsToNext: number(tier.pointsToNext, { integer: true }),
      progress: number(tier.progress),
    },
  };
}

function parseReward(value: unknown): ClubReward {
  const raw = record(value);
  return {
    id: text(raw.id),
    code: text(raw.code),
    titleFa: text(raw.titleFa),
    titleEn: text(raw.titleEn),
    descriptionFa: text(raw.descriptionFa),
    descriptionEn: text(raw.descriptionEn),
    costPoints: number(raw.costPoints, { integer: true }),
    minTier: tierId(raw.minTier),
    stock: nullableNumber(raw.stock, { integer: true }),
    expiresAt: nullableText(raw.expiresAt),
    canRedeem: raw.canRedeem === true,
    reason: rewardReason(raw.reason),
  };
}

function parseTransaction(value: unknown): ClubTransaction {
  const raw = record(value);
  const type = text(raw.type);
  const source = text(raw.source);
  if (type !== "earn" && type !== "redeem") badResponse();
  if (source !== "order" && source !== "review" && source !== "reward") badResponse();
  return {
    id: text(raw.id),
    type,
    source,
    points: number(raw.points, { integer: true }),
    balanceAfter: number(raw.balanceAfter, { integer: true }),
    description: nullableText(raw.description),
    createdAt: text(raw.createdAt),
  };
}

function parseRedemption(value: unknown): ClubRedemption {
  const raw = record(value);
  const status = text(raw.status);
  if (status !== "pending" && status !== "fulfilled" && status !== "cancelled") badResponse();
  const reward = raw.reward === null ? null : record(raw.reward);
  return {
    id: text(raw.id),
    code: text(raw.code),
    pointsSpent: number(raw.pointsSpent, { integer: true }),
    status,
    createdAt: text(raw.createdAt),
    fulfilledAt: nullableText(raw.fulfilledAt),
    reward: reward
      ? {
          id: text(reward.id),
          code: text(reward.code),
          titleFa: text(reward.titleFa),
          titleEn: text(reward.titleEn),
        }
      : null,
  };
}

function parseList<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) badResponse();
  return value.map(parse);
}

function parseDashboard(value: unknown): ClubDashboard {
  const raw = record(value);
  return {
    member: parseMember(raw.member),
    transactions: parseList(raw.transactions, parseTransaction),
    redemptions: parseList(raw.redemptions, parseRedemption),
    rewards: parseList(raw.rewards, parseReward),
  };
}

function parseMemberResponse(value: unknown): ClubMember {
  return parseMember(record(value).member);
}

function parseRedemptionResult(value: unknown): ClubRedemptionResult {
  const raw = record(value);
  return {
    duplicate: raw.duplicate === true,
    redemption: parseRedemption(raw.redemption),
    member: raw.member === null ? null : parseMember(raw.member),
  };
}

/* -------------------------------------------------------------------------- */
/* API                                                                        */
/* -------------------------------------------------------------------------- */

/** کاتالوگ عمومی؛ پیش از ورود هم قابل خواندن است (دلیل‌ها `login_required`). */
export async function fetchClubRewards(): Promise<ClubReward[]> {
  const data = await run(apiClient.get<{ rewards: unknown }>(`${CLUB_BASE}/rewards`));
  return parseList(record(data).rewards, parseReward);
}

/** اطلاعات حساب عضو واردشده؛ بدون کوکی معتبر ۴۰۱ می‌دهد. */
export async function fetchClubDashboard(): Promise<ClubDashboard> {
  const data = await run(apiClient.get<unknown>(`${CLUB_BASE}/me`, WITH_COOKIE));
  return parseDashboard(data);
}

export async function joinClub(input: ClubJoinInput): Promise<ClubMember> {
  const data = await run(apiClient.post<unknown>(`${CLUB_BASE}/join`, input, WITH_COOKIE));
  return parseMemberResponse(data);
}

export async function loginClub(input: ClubLoginInput): Promise<ClubMember> {
  const data = await run(apiClient.post<unknown>(`${CLUB_BASE}/login`, input, WITH_COOKIE));
  return parseMemberResponse(data);
}

/** بستن کوکی عضویت؛ پاسخ ۲۰۴ بدنه ندارد. */
export async function logoutClub(): Promise<void> {
  await run(apiClient.post<null>(`${CLUB_BASE}/logout`, null, WITH_COOKIE));
}

/**
 * کلید یکتای عملیات استرداد.
 *
 * سرور با همین کلید از ساخت رکورد تکراری جلوگیری می‌کند، پس اگر درخواست موفق
 * شد ولی پاسخ به مرورگر نرسید، ارسال دوباره همان نتیجه را برمی‌گرداند.
 */
export function createClubIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** استرداد پاداش؛ امتیاز و موجودی را سرور به‌صورت اتمی کم می‌کند. */
export async function redeemClubReward(
  rewardId: string,
  idempotencyKey = createClubIdempotencyKey(),
): Promise<ClubRedemptionResult> {
  const data = await run(
    apiClient.post<unknown>(
      `${CLUB_BASE}/rewards/${encodeURIComponent(rewardId)}/redeem`,
      { idempotencyKey },
      WITH_COOKIE,
    ),
  );
  return parseRedemptionResult(data);
}
