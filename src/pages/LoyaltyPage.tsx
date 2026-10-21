import {
  AlertCircle,
  BadgeCheck,
  Check,
  Crown,
  Gift,
  History,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  Sparkles,
  Ticket,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { isClubApiError, type ClubClaim } from "@/api/club";
import { ClubOwnershipVerification } from "@/components/ClubOwnershipVerification";
import { Captcha } from "@/components/Captcha";
import { PageIntro } from "@/components/PageIntro";
import { MotionSection } from "@/components/MotionSection";
import { MotionText } from "@/components/MotionText";
import { Button } from "@/components/ui/Button";
import { useLoyalty } from "@/context/LoyaltyContext";
import { loyaltyTiers } from "@/data/content";
import { useLanguage } from "@/hooks/useLanguage";
import type {
  ClubRedemption,
  ClubReward,
  ClubTierId,
  ClubTransaction,
} from "@/types";
import { cn } from "@/utils/cn";
import { formatLoyaltyNumber, POINTS_PER_REVIEW } from "@/utils/loyalty";
import { isValidPhone } from "@/utils/phone";

const tierStyles: Record<ClubTierId, string> = {
  bronze: "from-[#7b4635] to-[#b8754d] text-white",
  silver: "from-[#767b80] to-[#b8bec2] text-white",
  gold: "from-[#c87a12] via-[#f0a82f] to-[#ffd166] text-bun-ink",
};

const REASON_KEYS = {
  inactive: "loyalty.rewardReasons.inactive",
  expired: "loyalty.rewardReasons.expired",
  out_of_stock: "loyalty.rewardReasons.outOfStock",
  login_required: "loyalty.rewardReasons.loginRequired",
} as const;

const SOURCE_KEYS = {
  order: "loyalty.activity.sources.order",
  review: "loyalty.activity.sources.review",
  reward: "loyalty.activity.sources.reward",
  adjustment: "loyalty.activity.sources.adjustment",
} as const satisfies Record<ClubTransaction["source"], string>;

const STATUS_KEYS = {
  pending: "loyalty.activity.statuses.pending",
  fulfilled: "loyalty.activity.statuses.fulfilled",
  cancelled: "loyalty.activity.statuses.cancelled",
} as const satisfies Record<ClubRedemption["status"], string>;

const PIN_PATTERN = /^[\d\u06F0-\u06F9\u0660-\u0669]{4,8}$/;

function tierById(id: ClubTierId) {
  return loyaltyTiers.find((tier) => tier.id === id) ?? loyaltyTiers[0];
}

/** تاریخ ISO را با تقویم/زبان همان رابط می‌نویسد؛ مقدار نامعتبر خالی می‌شود. */
function formatClubDate(value: string, language: "fa" | "en"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language === "fa" ? "fa-IR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function LoyaltyPage() {
  const { t } = useTranslation();
  const language = useLanguage();
  const perks = t("loyalty.perks", { returnObjects: true }) as string[];
  const {
    member,
    pendingPoints,
    rewards,
    transactions,
    redemptions,
    loading,
    error,
    refresh,
    join,
    login,
    logout,
    redeem,
  } = useLoyalty();

  const [mode, setMode] = useState<"join" | "login">("join");
  const [claim, setClaim] = useState<ClubClaim | null>(null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [captchaNeeded, setCaptchaNeeded] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState("");
  const [redeemed, setRedeemed] = useState<{ code: string; title: string } | null>(null);

  const number = (value: number) => formatLoyaltyNumber(value, language);

  const authErrorText = (cause: unknown, currentMode: "join" | "login") => {
    if (!isClubApiError(cause)) return t("loyalty.networkError");
    if (cause.status === 401) return t("loyalty.loginError");
    if (cause.status === 409) return t("loyalty.duplicateError");
    if (cause.status === 429) return t("loyalty.rateLimitError");
    if (cause.status === 400) {
      return t(currentMode === "join" ? "loyalty.joinError" : "loyalty.loginError");
    }
    return t("loyalty.networkError");
  };

  const redeemErrorText = (cause: unknown) => {
    if (!isClubApiError(cause)) return t("loyalty.networkError");
    if (cause.status === 401) return t("loyalty.sessionExpired");
    if (cause.status === 400 || cause.status === 404) return t("loyalty.redeemUnavailable");
    if (cause.status === 429) return t("loyalty.rateLimitError");
    return t("loyalty.networkError");
  };

  const submitMembership = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    const trimmedName = name.trim();
    if (!isValidPhone(phone)) {
      setFeedback(t("loyalty.joinError"));
      return;
    }
    if (!PIN_PATTERN.test(pin.trim())) {
      setFeedback(t("loyalty.pinError"));
      return;
    }
    if (mode === "join" && trimmedName.length < 2) {
      setFeedback(t("loyalty.nameError"));
      return;
    }
    if (mode === "join" && captchaNeeded && !captchaToken) return;

    setFeedback("");
    setBusy(true);
    try {
      if (mode === "join") {
        setClaim(await join({ name: trimmedName, phone: phone.trim(), pin: pin.trim(), captchaToken: captchaToken || undefined }));
        setCaptchaNeeded(false);
      } else {
        await login({ phone: phone.trim(), pin: pin.trim() });
      }
      setName("");
      setPin("");
    } catch (cause) {
      if (isClubApiError(cause) && cause.code === "CAPTCHA_REQUIRED") {
        setCaptchaNeeded(true);
        setFeedback(language === "fa" ? "برای ادامه کپچا را تکمیل کنید." : "Please complete the captcha to continue.");
      } else {
        setFeedback(authErrorText(cause, mode));
      }
    } finally {
      setCaptchaToken("");
      setCaptchaReset(value => value + 1);
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setFeedback("");
    setRedeemError("");
    setRedeemed(null);
    try {
      await logout();
    } catch {
      // خروج محلی انجام نشد؛ همان پیام شبکه کافی است و عضو دوباره تلاش می‌کند.
      setFeedback(t("loyalty.networkError"));
    } finally {
      setLoggingOut(false);
    }
  };

  const handleRedeem = async (reward: ClubReward) => {
    if (!reward.canRedeem || redeemingId) return;
    setRedeemingId(reward.id);
    setRedeemError("");
    setRedeemed(null);
    try {
      const result = await redeem(reward.id);
      setRedeemed({
        code: result.redemption.code,
        title: language === "fa" ? reward.titleFa : reward.titleEn,
      });
    } catch (cause) {
      setRedeemError(redeemErrorText(cause));
    } finally {
      setRedeemingId(null);
    }
  };

  const memberTier = member ? tierById(member.tier.id) : null;
  const nextTier = member?.tier.nextTier ? tierById(member.tier.nextTier) : null;
  const progressPercent = member ? Math.round(Math.min(1, Math.max(0, member.tier.progress)) * 100) : 0;

  /** متن دلیل غیرفعال بودن پاداش؛ `ok` چیزی نشان نمی‌دهد. */
  const rewardReasonLabel = (reward: ClubReward): string => {
    if (reward.reason === "verification_required") return language === "fa" ? "ابتدا مالکیت موبایل را تأیید کنید" : "Verify your mobile first";
    if (reward.reason === "ok") return "";
    if (reward.reason === "insufficient_points") {
      return t("loyalty.rewardReasons.insufficientPointsShort", {
        points: number(Math.max(0, reward.costPoints - (member?.points ?? 0))),
      });
    }
    if (reward.reason === "tier_required") {
      return t("loyalty.rewardReasons.tierRequired", {
        tier: tierById(reward.minTier).name[language],
      });
    }
    return t(REASON_KEYS[reward.reason]);
  };


  return (
    <>
      <PageIntro
        kicker={t("loyalty.kicker")}
        title={t("loyalty.title")}
        description={t("loyalty.description")}
      />

      <MotionSection id="club-account" className="scroll-mt-28 bg-bun-paper py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div>
              <p className="section-kicker">{t("loyalty.accountKicker")}</p>
              <MotionText
                as="h2"
                text={member ? t("loyalty.memberGreeting", { name: member.name }) : t("loyalty.joinTitle")}
                className="section-title mt-3 max-w-xl"
              />
              <p className="section-copy mt-5 max-w-lg">
                {member ? t("loyalty.memberIntro") : t("loyalty.guestIntro")}
              </p>
              <ul className="mt-8 space-y-4">
                {(member
                  ? [t("loyalty.benefits.points"), t("loyalty.benefits.rewards"), t("loyalty.benefits.reviews")]
                  : [t("loyalty.benefits.join"), t("loyalty.benefits.points"), t("loyalty.benefits.rewards")]
                ).map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm font-bold leading-6 text-bun-text">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-bun-orange/15 text-bun-accent">
                      <Check className="size-3.5" aria-hidden="true" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              {claim ? <ClubOwnershipVerification initialClaim={claim} onVerified={() => setClaim(null)} /> : loading ? (
                <div
                  className="grid min-h-80 place-items-center rounded-[2rem] border border-bun-line bg-bun-surface p-8 shadow-lg"
                  role="status"
                  aria-live="polite"
                >
                  <div className="text-center">
                    <Loader2 className="mx-auto size-8 animate-spin text-bun-accent" aria-hidden="true" />
                    <p className="mt-4 text-sm font-bold text-bun-muted">{t("loyalty.loading")}</p>
                  </div>
                </div>
              ) : error ? (
                <div className="rounded-[2rem] border border-bun-red/25 bg-bun-red/5 p-7" role="alert">
                  <AlertCircle className="size-7 text-bun-red" aria-hidden="true" />
                  <p className="mt-3 font-display text-xl font-black text-bun-text">{t("loyalty.loadError")}</p>
                  <p className="mt-2 text-sm leading-6 text-bun-muted">{t("loyalty.loadErrorHint")}</p>
                  <Button type="button" variant="secondary" className="mt-5" onClick={() => void refresh()}>
                    <RefreshCw className="size-4" aria-hidden="true" />
                    {t("loyalty.retry")}
                  </Button>
                </div>
              ) : member && memberTier ? (

                <div className="overflow-hidden rounded-[2rem] border border-bun-line bg-bun-surface shadow-xl">
                  <div className={cn("bg-gradient-to-br p-6 sm:p-8", tierStyles[member.tier.id])}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-12 place-items-center rounded-full bg-white/20">
                          <Crown className="size-6" aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.18em] opacity-80">
                            {t("loyalty.memberTitle")}
                          </p>
                          <p className="mt-1 font-display text-2xl font-black">{member.name}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleLogout()}
                        disabled={loggingOut}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-black/15 px-4 py-2 text-xs font-black outline-none transition hover:bg-black/25 focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-wait disabled:opacity-60"
                      >
                        {loggingOut ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <LogOut className="size-3.5" aria-hidden="true" />
                        )}
                        {t("loyalty.logout")}
                      </button>
                    </div>

                    <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="font-display text-6xl font-black leading-none">{number(member.points)}</p>
                        <p className="mt-2 text-sm font-black uppercase tracking-[0.16em] opacity-80">
                          {t("loyalty.pointsLabel")}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="text-xs font-black uppercase tracking-[0.16em] opacity-75">
                          {t("loyalty.tierLabel")}
                        </p>
                        <p className="mt-1 font-display text-2xl font-black">{memberTier.name[language]}</p>
                        <p className="mt-1 text-xs font-bold opacity-75" dir="ltr">
                          {member.phone}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 sm:p-8">
                    {member.verificationStatus !== "verified" && <ClubOwnershipVerification member={member} />}
                    <p className="my-3 text-sm font-bold">{language === "fa" ? "امتیاز در انتظار تأیید: " : "Pending points: "}{number(pendingPoints)}</p>
                    <div className="flex items-end justify-between gap-4">
                      <span className="font-display text-2xl font-black text-bun-text">
                        {nextTier ? nextTier.name[language] : t("loyalty.topTierShort")}
                      </span>
                      <span className="pb-1 text-sm font-bold text-bun-muted" dir="ltr">
                        {member.tier.nextThreshold === null
                          ? number(member.points)
                          : `${number(member.points)} / ${number(member.tier.nextThreshold)}`}
                      </span>
                    </div>
                    <div
                      className="mt-3 h-3 overflow-hidden rounded-full bg-bun-line"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={member.tier.nextThreshold ?? member.points}
                      aria-valuenow={member.points}
                      aria-label={t("loyalty.progressLabel")}
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-bun-red via-bun-orange to-bun-gold transition-[width] duration-500"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <p className="mt-3 text-sm font-bold text-bun-muted">
                      {nextTier
                        ? t("loyalty.pointsToNext", {
                            points: number(member.tier.pointsToNext),
                            tier: nextTier.name[language],
                          })
                        : t("loyalty.topTier")}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-bun-muted">{t("loyalty.orderPoints")}</p>
                    <p className="mt-4 text-xs font-bold text-bun-muted">
                      {t("loyalty.memberSince", { date: formatClubDate(member.joinedAt, language) })}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-[2rem] border border-bun-line bg-bun-surface p-6 shadow-xl sm:p-8">
                  <div className="flex rounded-full bg-bun-paper p-1" role="tablist" aria-label={t("loyalty.accountKicker")}>
                    {(["join", "login"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={mode === tab}
                        onClick={() => {
                          setMode(tab);
                          setFeedback("");
                        }}
                        className={cn(
                          "flex-1 cursor-pointer rounded-full px-4 py-2.5 text-sm font-black outline-none transition focus-visible:ring-2 focus-visible:ring-bun-gold",
                          mode === tab ? "bg-bun-ink text-white shadow" : "text-bun-muted hover:text-bun-text",
                        )}
                      >
                        {t(tab === "join" ? "loyalty.joinTab" : "loyalty.loginTab")}
                      </button>
                    ))}
                  </div>

                  <form className="mt-6 space-y-4" onSubmit={submitMembership} noValidate>
                    {mode === "join" ? (
                      <div>
                        <label htmlFor="club-name" className="mb-1.5 block text-xs font-black text-bun-text">
                          {t("loyalty.nameLabel")}
                        </label>
                        <input
                          id="club-name"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          autoComplete="name"
                          maxLength={60}
                          placeholder={t("loyalty.namePlaceholder")}
                          className="h-12 w-full rounded-xl border border-bun-line bg-bun-paper px-4 text-sm text-bun-text outline-none placeholder:text-bun-muted focus:border-bun-orange focus:ring-2 focus:ring-bun-orange/20"
                        />
                      </div>
                    ) : null}
                    <div>
                      <label htmlFor="club-phone" className="mb-1.5 block text-xs font-black text-bun-text">
                        {t("loyalty.phoneLabel")}
                      </label>
                      <input
                        id="club-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder={t("loyalty.phonePlaceholder")}
                        dir="ltr"
                        className="h-12 w-full rounded-xl border border-bun-line bg-bun-paper px-4 text-sm text-bun-text outline-none placeholder:text-bun-muted focus:border-bun-orange focus:ring-2 focus:ring-bun-orange/20"
                      />
                    </div>
                    <div>
                      <label htmlFor="club-pin" className="mb-1.5 block text-xs font-black text-bun-text">
                        {t("loyalty.pinLabel")}
                      </label>
                      <input
                        id="club-pin"
                        type="password"
                        inputMode="numeric"
                        autoComplete={mode === "join" ? "new-password" : "current-password"}
                        value={pin}
                        onChange={(event) => setPin(event.target.value)}
                        placeholder={t("loyalty.pinPlaceholder")}
                        dir="ltr"
                        maxLength={8}
                        className="h-12 w-full rounded-xl border border-bun-line bg-bun-paper px-4 text-sm tracking-[0.3em] text-bun-text outline-none placeholder:tracking-normal placeholder:text-bun-muted focus:border-bun-orange focus:ring-2 focus:ring-bun-orange/20"
                      />
                      <p className="mt-1.5 text-xs leading-5 text-bun-muted">{t("loyalty.pinHint")}</p>
                    </div>

                    {feedback ? (
                      <p role="alert" className="rounded-xl bg-bun-red/10 px-4 py-3 text-sm font-bold text-bun-red">
                        {feedback}
                      </p>
                    ) : null}

                    {mode === "join" && captchaNeeded && <Captcha onToken={setCaptchaToken} resetKey={captchaReset} />}
                    <Button type="submit" size="lg" className="w-full" disabled={busy || (mode === "join" && captchaNeeded && !captchaToken)}>
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Lock className="size-4" aria-hidden="true" />
                      )}
                      {busy
                        ? t("loyalty.submitting")
                        : t(mode === "join" ? "loyalty.joinAction" : "loyalty.loginAction")}
                    </Button>
                  </form>
                  <p className="mt-5 text-xs leading-6 text-bun-muted">{t("loyalty.joinHint")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </MotionSection>
      <MotionSection className="bg-bun-surface py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="section-kicker">{t("loyalty.rewardsKicker")}</p>
              <MotionText as="h2" text={t("loyalty.rewardsTitle")} className="section-title mt-3" />
              <p className="section-copy mt-4">
                {member ? t("loyalty.rewardsMemberText") : t("loyalty.rewardsGuestText")}
              </p>
            </div>
            {member ? (
              <div className="rounded-2xl border border-bun-line bg-bun-paper px-5 py-4 text-end">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-bun-muted">
                  {t("loyalty.balanceLabel")}
                </p>
                <p className="mt-1 font-display text-3xl font-black text-bun-text">
                  {number(member.points)}
                </p>
              </div>
            ) : (
              <a
                href="#club-account"
                className="inline-flex h-11 items-center justify-center rounded-full bg-bun-ink px-6 text-sm font-black text-white outline-none transition hover:bg-bun-red focus-visible:ring-2 focus-visible:ring-bun-gold"
              >
                {t("loyalty.joinAction")}
              </a>
            )}
          </div>

          {redeemed ? (
            <div
              role="status"
              aria-live="polite"
              className="mt-8 flex flex-wrap items-center gap-5 rounded-3xl border border-bun-gold/50 bg-bun-gold/10 p-5 sm:p-6"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-bun-gold text-bun-ink">
                <Ticket className="size-6" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-bun-text">{t("loyalty.redeemSuccess")}</p>
                <p className="mt-0.5 truncate text-sm font-bold text-bun-muted">{redeemed.title}</p>
                <p className="mt-2 font-mono text-2xl font-black tracking-[0.18em] text-bun-text" dir="ltr">
                  {redeemed.code}
                </p>
                <p className="mt-1 text-xs leading-5 text-bun-muted">{t("loyalty.redeemCodeHint")}</p>
              </div>
              <button
                type="button"
                onClick={() => setRedeemed(null)}
                className="cursor-pointer rounded-full border border-bun-line bg-bun-surface px-4 py-2 text-xs font-black text-bun-text outline-none hover:border-bun-orange focus-visible:ring-2 focus-visible:ring-bun-gold"
              >
                {t("loyalty.dismiss")}
              </button>
            </div>
          ) : null}

          {redeemError ? (
            <p role="alert" className="mt-6 rounded-2xl bg-bun-red/10 px-5 py-4 text-sm font-bold text-bun-red">
              {redeemError}
            </p>
          ) : null}



          {loading && rewards.length === 0 ? (
            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3" role="status" aria-live="polite">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-64 animate-pulse rounded-3xl border border-bun-line bg-bun-paper" />
              ))}
              <span className="sr-only">{t("loyalty.rewardsLoading")}</span>
            </div>
          ) : rewards.length === 0 ? (
            <div className="mt-10 rounded-3xl border border-dashed border-bun-line bg-bun-paper px-6 py-14 text-center">
              <Gift className="mx-auto size-9 text-bun-muted" aria-hidden="true" />
              <p className="mt-4 font-display text-xl font-black text-bun-text">{t("loyalty.rewardsEmpty")}</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-bun-muted">
                {t("loyalty.rewardsEmptyHint")}
              </p>
            </div>
          ) : (
            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {rewards.map((reward) => {
                const requiredTier = tierById(reward.minTier);
                const reason = rewardReasonLabel(reward);
                const isRedeeming = redeemingId === reward.id;
                return (
                  <article
                    key={reward.id}
                    className={cn(
                      "flex flex-col rounded-3xl border bg-bun-paper p-6 transition",
                      reward.canRedeem
                        ? "border-bun-gold/50 shadow-[0_18px_50px_-30px_rgba(200,122,18,0.55)] hover:-translate-y-0.5"
                        : "border-bun-line",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={cn(
                          "grid size-11 place-items-center rounded-2xl",
                          reward.canRedeem ? "bg-bun-gold/20 text-bun-accent" : "bg-bun-line/60 text-bun-muted",
                        )}
                      >
                        <Gift className="size-5" aria-hidden="true" />
                      </span>
                      <span className="rounded-full bg-bun-surface px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-bun-muted">
                        {requiredTier.name[language]}
                      </span>
                    </div>
                    <h3 className="mt-4 font-display text-xl font-black leading-tight text-bun-text">
                      {language === "fa" ? reward.titleFa : reward.titleEn}
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-6 text-bun-muted">
                      {language === "fa" ? reward.descriptionFa : reward.descriptionEn}
                    </p>
                    <div className="mt-5 flex items-end justify-between gap-3 border-t border-bun-line pt-4">
                      <div>
                        <p className="font-display text-2xl font-black text-bun-text">{number(reward.costPoints)}</p>
                        <p className="text-xs font-bold text-bun-muted">{t("loyalty.pointsLabel")}</p>
                      </div>
                      {reward.stock !== null ? (
                        <p className="text-xs font-bold text-bun-muted">
                          {t("loyalty.stockLeft", { count: number(reward.stock) })}
                        </p>
                      ) : null}
                    </div>
                    {reason ? (
                      <p className="mt-3 text-xs font-bold text-bun-muted">{reason}</p>
                    ) : null}
                    <div className="mt-4">
                      {member ? (
                        <Button
                          type="button"
                          variant={reward.canRedeem ? "primary" : "secondary"}
                          className=" w-full"
                          disabled={!reward.canRedeem || redeemingId !== null}
                          onClick={() => void handleRedeem(reward)}
                        >
                          {isRedeeming ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          ) : reward.canRedeem ? (
                            <Gift className="size-4" aria-hidden="true" />
                          ) : (
                            <Lock className="size-4" aria-hidden="true" />
                          )}
                          {isRedeeming
                            ? t("loyalty.redeeming")
                            : reward.reason === "out_of_stock"
                              ? t("loyalty.rewardReasons.outOfStock")
                              : reward.reason === "expired"
                                ? t("loyalty.rewardReasons.expired")
                                : reward.reason === "ok"
                                  ? t("loyalty.redeemAction")
                                  : t("loyalty.redeemUnavailableShort")}
                        </Button>
                      ) : (
                        <a
                          href="#club-account"
                          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-bun-line bg-bun-surface text-sm font-black text-bun-text outline-none transition hover:border-bun-orange focus-visible:ring-2 focus-visible:ring-bun-gold"
                        >
                          <Lock className="size-4" aria-hidden="true" />
                          {t("loyalty.signInToRedeem")}
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </MotionSection>

      <MotionSection id="club-tiers" className="bg-bun-surface py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="section-kicker">{t("loyalty.tiersKicker")}</p>
          <MotionText as="h2" text={t("loyalty.tiersTitle")} className="section-title mt-3 max-w-3xl" />
          <p className="section-copy mt-4 max-w-2xl">{t("loyalty.tiersText")}</p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {loyaltyTiers.map((tier) => (
              <article
                key={tier.id}
                className={cn(
                  "relative min-h-72 overflow-hidden rounded-[1.75rem] bg-gradient-to-br p-7 shadow-lg transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-xl",
                  tierStyles[tier.id],
                )}
              >
                <div className="absolute -end-12 -top-12 size-40 rounded-full border-[24px] border-white/10" />
                <div className="relative flex h-full flex-col">
                  <div className="flex items-center justify-between">
                    {tier.id === "gold" ? (
                      <Crown className="size-7" aria-hidden="true" />
                    ) : tier.id === "silver" ? (
                      <Sparkles className="size-7" aria-hidden="true" />
                    ) : (
                      <Gift className="size-7" aria-hidden="true" />
                    )}
                    <span className="font-display text-3xl font-black">{tier.multiplier}</span>
                  </div>
                  <h3 className="mt-12 font-display text-4xl font-black tracking-tight">
                    {tier.name[language]}
                  </h3>
                  <p className="mt-2 text-sm font-bold opacity-75">{tier.points[language]}</p>
                  {member?.tier.id === tier.id ? (
                    <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-black">
                      <Check className="size-3.5" aria-hidden="true" />
                      {t("loyalty.currentTier")}
                    </span>
                  ) : null}
                  <p className="mt-auto pt-7 text-sm leading-6 opacity-85">{tier.description[language]}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </MotionSection>

      <MotionSection className="bg-bun-paper py-16 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <div className="rounded-[2rem] bg-gradient-to-br from-bun-ink via-bun-burgundy to-bun-red p-7 text-white sm:p-9">
            <p className="section-kicker !text-bun-orange">{t("loyalty.perksTitle")}</p>
            <ul className="mt-7 space-y-5">
              {perks.map((perk) => (
                <li key={perk} className="flex items-center gap-4 text-base font-bold">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/15 text-bun-gold">
                    <Check className="size-4" aria-hidden="true" />
                  </span>
                  {perk}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="section-kicker">{t("loyalty.earnKicker")}</p>
            <MotionText as="h2" text={t("loyalty.earnTitle")} className="section-title mt-3" />
            <div className="mt-8 space-y-5">
              <div className="rounded-2xl border border-bun-line bg-bun-surface p-5">
                <p className="text-sm font-black text-bun-text">{t("loyalty.earn.orderTitle")}</p>
                <p className="mt-1 text-sm leading-6 text-bun-muted">{t("loyalty.earn.orderText")}</p>
              </div>
              <div className="rounded-2xl border border-bun-line bg-bun-surface p-5">
                <p className="text-sm font-black text-bun-text">{t("loyalty.earn.reviewTitle")}</p>
                <p className="mt-1 text-sm leading-6 text-bun-muted">
                  {t("loyalty.earn.reviewText", { points: number(POINTS_PER_REVIEW) })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </MotionSection>

      {member ? (
        <MotionSection className="bg-bun-surface py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-bun-line bg-bun-surface p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-2xl bg-bun-orange/15 text-bun-accent">
                    <History className="size-5" aria-hidden="true" />
                  </span>
                  <h2 className="font-display text-2xl font-black text-bun-text">{t("loyalty.activity.title")}</h2>
                </div>
                {transactions.length === 0 ? (
                  <p className="mt-6 rounded-2xl border border-dashed border-bun-line px-5 py-8 text-center text-sm font-bold text-bun-muted">
                    {t("loyalty.activity.empty")}
                  </p>
                ) : (
                  <ul className="mt-5 divide-y divide-bun-line">
                    {transactions.slice(0, 6).map((item) => (
                      <li key={item.id} className="flex items-center gap-3 py-3.5">
                        <span
                          className={cn(
                            "grid size-9 shrink-0 place-items-center rounded-full text-xs font-black",
                            item.points >= 0
                              ? "bg-bun-gold/20 text-bun-accent"
                              : "bg-bun-red/10 text-bun-red",
                          )}
                        >
                          {item.points >= 0 ? "+" : "−"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-bun-text">
                            {t(SOURCE_KEYS[item.source])}
                          </p>
                          {item.status === "legacy_unverified" && <p className="text-xs font-bold text-bun-muted">{language === "fa" ? "سابقهٔ قدیمی؛ قابل مصرف فقط پس از تأیید موبایل" : "Historical entry; available only after mobile verification"}</p>}
                          <p className="mt-0.5 truncate text-xs font-bold text-bun-muted">
                            {item.description || t("loyalty.activity.noReference")}
                            {formatClubDate(item.createdAt, language)
                              ? ` · ${formatClubDate(item.createdAt, language)}`
                              : ""}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 font-display text-lg font-black",
                            item.points >= 0 ? "text-bun-accent" : "text-bun-red",
                          )}
                          dir="ltr"
                        >
                          {item.points >= 0 ? "+" : ""}
                          {number(item.points)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-3xl border border-bun-line bg-bun-surface p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-2xl bg-bun-gold/20 text-bun-accent">
                    <Ticket className="size-5" aria-hidden="true" />
                  </span>
                  <h2 className="font-display text-2xl font-black text-bun-text">{t("loyalty.redemptions.title")}</h2>
                </div>
                {redemptions.length === 0 ? (
                  <p className="mt-6 rounded-2xl border border-dashed border-bun-line px-5 py-8 text-center text-sm font-bold text-bun-muted">
                    {t("loyalty.redemptions.empty")}
                  </p>
                ) : (
                  <ul className="mt-5 space-y-3">
                    {redemptions.slice(0, 5).map((item) => (
                      <li key={item.id} className="rounded-2xl border border-bun-line bg-bun-paper p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-black text-bun-text">
                              {item.reward
                                ? language === "fa"
                                  ? item.reward.titleFa
                                  : item.reward.titleEn
                                : t("loyalty.redemptions.unknownReward")}
                            </p>
                            <p className="mt-1 font-mono text-sm font-black tracking-[0.12em] text-bun-muted" dir="ltr">
                              {item.code}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-[0.1em]",
                              item.status === "fulfilled"
                                ? "bg-emerald-100 text-emerald-800"
                                : item.status === "cancelled"
                                  ? "bg-bun-line text-bun-muted"
                                  : "bg-bun-gold/20 text-bun-accent",
                            )}
                          >
                            {item.status === "fulfilled" ? (
                              <BadgeCheck className="size-3" aria-hidden="true" />
                            ) : null}
                            {t(STATUS_KEYS[item.status])}
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-bold text-bun-muted">
                          {t("loyalty.redemptions.spent", { points: number(item.pointsSpent) })}
                          {formatClubDate(item.createdAt, language)
                            ? ` · ${formatClubDate(item.createdAt, language)}`
                            : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </MotionSection>
      ) : null}
    </>
  );
}
