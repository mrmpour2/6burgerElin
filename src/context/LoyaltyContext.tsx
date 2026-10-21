import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ClubApiError,
  fetchClubDashboard,
  fetchClubRewards,
  isClubApiError,
  isClubUnauthorized,
  joinClub,
  verifyClubClaim,
  type ClubClaim,
  loginClub,
  logoutClub,
  redeemClubReward,
  type ClubJoinInput,
  type ClubLoginInput,
} from "@/api/club";
import type {
  ClubDashboard,
  ClubMember,
  ClubRedemption,
  ClubRedemptionResult,
  ClubReward,
  ClubTransaction,
} from "@/types";

/**
 * باشگاه مشتریان شیش برگر الین — وضعیت سروری.
 *
 * عضویت، ورود، امتیاز، سطح و پاداش‌ها همه از API باشگاه
 * (`dashboard/backend/src/routes/clubRoutes.js`) می‌آیند. کوکی HttpOnly عضویت را
 * خود مرورگر نگه می‌دارد؛ این Context نه توکن ذخیره می‌کند و نه امتیازی در
 * localStorage می‌سازد. در نتیجه:
 *
 *   - امتیاز سفارش فقط پس از `PAID` شدن سفارش (در بک‌اند) اضافه می‌شود،
 *   - امتیاز نظر فقط پس از تأیید نظر (در بک‌اند) اضافه می‌شود،
 *   - خروج از حساب فقط کوکی را پاک می‌کند و موجودی روی سرور می‌ماند.
 */

interface LoyaltyState {
  pendingPoints: number;
  member: ClubMember | null;
  rewards: ClubReward[];
  transactions: ClubTransaction[];
  redemptions: ClubRedemption[];
  /** در حال خواندن نشست/کاتالوگ در بار اول یا تلاش دوباره. */
  loading: boolean;
  /** خطای شبکه یا سرور (خطای ۴۰۱ یعنی مهمان است، نه خطا). */
  error: ClubApiError | null;
}

interface LoyaltyContextValue extends LoyaltyState {
  /** `true` وقتی نشست معتبر و عضو واردشده داریم. */
  isMember: boolean;
  /** خواندن دوباره نشست و کاتالوگ (مثلاً پس از بازگشت از درگاه). */
  refresh: () => Promise<void>;
  /** ادعای مالکیت؛ نشست باشگاه فقط پس از OTP ساخته می‌شود. */
  join: (input: ClubJoinInput) => Promise<ClubClaim>;
  verify: (claimId: string, code: string, captchaToken?: string) => Promise<ClubMember>;
  /** ورود عضو موجود با شماره و رمز. */
  login: (input: ClubLoginInput) => Promise<ClubMember>;
  /** خروج؛ کوکی HttpOnly سمت سرور پاک می‌شود. */
  logout: () => Promise<void>;
  /** استرداد پاداش؛ موجودی و دفتر امتیاز را سرور اتمی تغییر می‌دهد. */
  redeem: (rewardId: string) => Promise<ClubRedemptionResult>;
}

const LoyaltyContext = createContext<LoyaltyContextValue | null>(null);

const EMPTY_STATE: LoyaltyState = {
  pendingPoints: 0,
  member: null,
  rewards: [],
  transactions: [],
  redemptions: [],
  loading: true,
  error: null,
};

/** هر خطای ناشناخته را به شکل قابل‌نمایش در Context درمی‌آورد. */
function asClubError(error: unknown): ClubApiError {
  return isClubApiError(error)
    ? error
    : new ClubApiError("ارتباط با سرور برقرار نشد.", 0, "CLUB_NETWORK_ERROR");
}

/** کاتالوگ مهمان: دلیل واقعی موجودی/انقضا حفظ می‌شود، بقیه نیازمند ورودند. */
function asGuestRewards(rewards: ClubReward[]): ClubReward[] {
  return rewards.map((reward) => {
    if (reward.reason === "out_of_stock" || reward.reason === "expired") return reward;
    return { ...reward, canRedeem: false, reason: "login_required" };
  });
}

export function LoyaltyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LoyaltyState>(EMPTY_STATE);
  /** شمارندهٔ درخواست‌ها تا پاسخ قدیمی روی وضعیت تازه نوشته نشود. */
  const requestIdRef = useRef(0);

  const applyDashboard = useCallback((dashboard: ClubDashboard) => {
    setState({
      pendingPoints: dashboard.pendingPoints,
      member: dashboard.member,
      rewards: dashboard.rewards,
      transactions: dashboard.transactions,
      redemptions: dashboard.redemptions,
      loading: false,
      error: null,
    });
  }, []);

  /** خواندن نشست فعلی + کاتالوگ عمومی؛ ۴۰۱ یعنی مهمان، نه خطا. */
  const bootstrap = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setState((current) => ({ ...current, loading: true, error: null }));

    const [rewardsResult, dashboardResult] = await Promise.allSettled([
      fetchClubRewards(),
      fetchClubDashboard(),
    ]);
    if (requestId !== requestIdRef.current) return;

    if (dashboardResult.status === "fulfilled") {
      applyDashboard(dashboardResult.value);
      return;
    }

    const rewards = rewardsResult.status === "fulfilled" ? rewardsResult.value : [];
    const unauthorized = isClubUnauthorized(dashboardResult.reason);

    setState((current) => ({
      ...current,
      member: unauthorized ? null : current.member,
      rewards: unauthorized ? asGuestRewards(rewards) : current.rewards,
      transactions: unauthorized ? [] : current.transactions,
      redemptions: unauthorized ? [] : current.redemptions,
      loading: false,
      error: unauthorized
        ? rewardsResult.status === "rejected"
          ? asClubError(rewardsResult.reason)
          : null
        : asClubError(dashboardResult.reason),
    }));
  }, [applyDashboard]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  /** پس از join/login داده‌های کامل حساب را با همان کوکی تازه می‌خواند. */
  const syncAccount = useCallback(async () => {
    try {
      const dashboard = await fetchClubDashboard();
      requestIdRef.current += 1;
      applyDashboard(dashboard);
    } catch (error) {
      requestIdRef.current += 1;
      if (isClubUnauthorized(error)) {
        setState((current) => ({
          ...current,
          member: null,
          transactions: [],
          redemptions: [],
          loading: false,
          error: null,
        }));
        return;
      }
      setState((current) => ({
        ...current,
        loading: false,
        error: asClubError(error),
      }));
    }
  }, [applyDashboard]);

  const join = useCallback((input: ClubJoinInput) => joinClub(input), []);

  const verify = useCallback(
    async (claimId: string, code: string, captchaToken?: string) => {
      const member = await verifyClubClaim(claimId, code, captchaToken);
      requestIdRef.current += 1;
      setState((current) => ({ ...current, member, loading: false, error: null }));
      await syncAccount();
      return member;
    },
    [syncAccount],
  );

  const login = useCallback(
    async (input: ClubLoginInput) => {
      const member = await loginClub(input);
      requestIdRef.current += 1;
      setState((current) => ({ ...current, member, loading: false, error: null }));
      await syncAccount();
      return member;
    },
    [syncAccount],
  );

  const logout = useCallback(async () => {
    await logoutClub();
    // پاسخ bootstrap در پرواز نباید عضو قبلی را برگرداند.
    requestIdRef.current += 1;
    setState((current) => ({
      pendingPoints: 0,
      member: null,
      rewards: asGuestRewards(current.rewards),
      transactions: [],
      redemptions: [],
      loading: false,
      error: null,
    }));

    // شرایط پاداش‌ها پس از خروج دوباره از سرور خوانده می‌شود تا دلیل‌ها دقیق
    // باشند؛ شکست این درخواست نباید خروج موفق را به خطا تبدیل کند.
    try {
      const rewards = await fetchClubRewards();
      setState((current) => ({ ...current, rewards: asGuestRewards(rewards) }));
    } catch {
      // کاتالوگ قبلی با دلیل `login_required` نمایش داده می‌شود.
    }
  }, []);


  const redeem = useCallback(
    async (rewardId: string) => {
      const result = await redeemClubReward(rewardId);
      requestIdRef.current += 1;

      // نتیجهٔ سرور بلافاصله اعمال می‌شود تا حتی اگر تازه‌سازی بعدی شکست بخورد
      // کاربر کد پاداش و موجودی تازه را ببیند.
      setState((current) => {
        const redemptions = [
          result.redemption,
          ...current.redemptions.filter((item) => item.id !== result.redemption.id),
        ].slice(0, 10);
        return {
          ...current,
          member: result.member ?? current.member,
          redemptions,
          error: null,
        };
      });

      // دلیل «قابل دریافت بودن» بقیهٔ پاداش‌ها فقط سمت سرور محاسبه می‌شود.
      try {
        const dashboard = await fetchClubDashboard();
        applyDashboard(dashboard);
      } catch {
        // استرداد انجام شده؛ خطای تازه‌سازی نباید آن را ناموفق نشان دهد.
      }
      return result;
    },
    [applyDashboard],
  );

  const value = useMemo<LoyaltyContextValue>(
    () => ({
      ...state,
      isMember: state.member !== null,
      refresh: bootstrap,
      join,
      verify,
      login,
      logout,
      redeem,
    }),
    [state, bootstrap, join, verify, login, logout, redeem],
  );

  return <LoyaltyContext value={value}>{children}</LoyaltyContext>;
}

export function useLoyalty(): LoyaltyContextValue {
  const context = use(LoyaltyContext);
  if (!context) throw new Error("useLoyalty must be used within LoyaltyProvider");
  return context;
}

