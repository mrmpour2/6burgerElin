import { useEffect, useState, type FormEvent } from "react";
import { isClubApiError, resendClubClaim, type ClubClaim } from "@/api/club";
import { useLoyalty } from "@/context/LoyaltyContext";
import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui/Button";
import { Captcha } from "@/components/Captcha";
import type { ClubMember } from "@/types";

const digits = (value: string) => value.replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x6f0)).replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x660));

export function ClubOwnershipVerification({ initialClaim = null, member, onVerified }: { initialClaim?: ClubClaim | null; member?: ClubMember; onVerified?: () => void }) {
  const language = useLanguage();
  const fa = language === "fa";
  const { join, verify } = useLoyalty();
  const [claim, setClaim] = useState(initialClaim);
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [captchaNeeded, setCaptchaNeeded] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const [resendAt, setResendAt] = useState(() => Date.now() + (initialClaim?.resendAfter ?? 0) * 1000);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const captchaMessage = fa ? "برای ادامه کپچا را تکمیل کنید." : "Please complete the captcha to continue.";
  const resetCaptcha = () => { setCaptchaToken(""); setCaptchaReset(value => value + 1); };
  const failure = (error: unknown) => {
    if (isClubApiError(error) && error.code === "CAPTCHA_REQUIRED") {
      setCaptchaNeeded(true);
      setMessage(captchaMessage);
    } else {
      setMessage(isClubApiError(error) ? error.message : fa ? "ارتباط با سرور برقرار نشد." : "Could not reach the server.");
    }
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (captchaNeeded && !captchaToken) { setMessage(captchaMessage); return; }
    setBusy(true); setMessage("");
    try {
      if (claim) {
        await verify(claim.claimId, code, captchaToken || undefined);
        onVerified?.();
      } else if (member) {
        const next = await join({ phone: member.phone, name: member.name, pin, captchaToken: captchaToken || undefined });
        setClaim(next); setPin(""); setResendAt(Date.now() + next.resendAfter * 1000);
        setCaptchaNeeded(false);
      }
    } catch (error) { failure(error); } finally { resetCaptcha(); setBusy(false); }
  }
  async function resend() {
    if (!claim || busy || remaining) return;
    if (captchaNeeded && !captchaToken) { setMessage(captchaMessage); return; }
    setBusy(true); setMessage("");
    try { const next = await resendClubClaim(claim.claimId, captchaToken || undefined); setClaim(next); setCode(""); setCaptchaNeeded(false); setResendAt(Date.now() + next.resendAfter * 1000); }
    catch (error) { failure(error); } finally { resetCaptcha(); setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-4 rounded-2xl border border-bun-line bg-bun-paper p-6">
    <h3 className="font-bold">{fa ? "تأیید مالکیت موبایل" : "Verify mobile ownership"}</h3>
    <p className="text-sm leading-6">{fa ? "امتیازها تا تأیید موبایل قابل مصرف نیستند. رمز پنل به‌تنهایی مالکیت شماره را ثابت نمی‌کند." : "Points remain unavailable until mobile verification. Your panel PIN alone does not prove ownership."}</p>
    {claim ? <>
      <p role="status" className="text-sm">{fa ? "در صورت امکان کد ارسال می‌شود؛ کد ۶ رقمی تا ۵ دقیقه معتبر است." : "A code will be sent if possible; the six-digit code is valid for five minutes."}</p>
      <label className="block text-sm font-bold" htmlFor="club-ownership-code">{fa ? "کد تأیید پیامکی" : "SMS verification code"}</label>
      <input id="club-ownership-code" value={code} onChange={e => setCode(digits(e.target.value).replace(/[^0-9]/g, ""))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required dir="ltr" className="h-12 w-full rounded-xl border border-bun-line bg-bun-surface px-4" />
      <Button type="submit" disabled={busy || code.length !== 6 || (captchaNeeded && !captchaToken)}>{fa ? "تأیید و ورود" : "Verify and sign in"}</Button>
      <Button type="button" variant="secondary" disabled={busy || remaining > 0 || (captchaNeeded && !captchaToken)} onClick={() => void resend()}>{remaining ? `${fa ? "ارسال مجدد پس از" : "Resend in"} ${remaining}s` : fa ? "ارسال دوباره کد" : "Resend code"}</Button>
    </> : <>
      <p dir="ltr">{member?.phone}</p>
      <label className="block text-sm font-bold" htmlFor="club-reverify-pin">{fa ? "رمز جدید پنل (۴ تا ۸ رقم)" : "New panel PIN (4–8 digits)"}</label>
      <input id="club-reverify-pin" type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4,8}" minLength={4} maxLength={8} required value={pin} onChange={e => setPin(digits(e.target.value))} className="h-12 w-full rounded-xl border border-bun-line bg-bun-surface px-4" />
      <Button type="submit" disabled={busy || (captchaNeeded && !captchaToken)}>{fa ? "دریافت کد تأیید موبایل" : "Request verification code"}</Button>
    </>}
    {captchaNeeded && <Captcha onToken={setCaptchaToken} resetKey={captchaReset} />}
    {message && <p role="alert" className="text-sm text-bun-red">{message}</p>}
  </form>;
}
