export type Language = "en" | "fa";

export type LocalizedText = Record<Language, string>;
import type { ComponentType, SVGProps } from "react";
import type { LucideIcon } from "lucide-react";
type IconComponent =
  | LucideIcon
  | ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Scroll-reveal presets understood by the GSAP motion system
 * (`src/motion/motionSystem.ts`). Declared here so markup and engine share
 * one source of truth.
 */
export type RevealPreset = "fade-up" | "blur-in" | "scale" | "slide-left" | "slide-right";

export type MenuCategory = "burgers" | "pizza" | "sides" | "drinks" | "combos";

/**
 * یک واریانت (اندازه/بسته) از یک آیتم منو؛ مثل پیتزای تک‌نفره، دو نفره و
 * شش‌نفره.
 *
 * قیمت هر واریانت مستقل است و هنگام افزودن به سبد، همان قیمتِ انتخاب‌شده ثبت
 * می‌شود؛ بنابراین یک پیتزا می‌تواند سه سطر جدا در سبد داشته باشد.
 */
export interface MenuItemVariant {
  /**
   * شناسه واریانت در دیتابیس پنل. واریانت‌های ثابت کاتالوگ این فیلد را ندارند
   * (چون محصولشان شناسه دیتابیس ندارد و قابل سفارش آنلاین نیست).
   */
  id?: string;
  /** کلید یکتای واریانت داخل همان آیتم؛ برای انتخاب کاربر و کلید سطر سبد. */
  key: string;
  label: LocalizedText;
  price: number;
  /** موجودی اختصاصی واریانت؛ `undefined` یعنی موجودی خودِ محصول ملاک است. */
  stock?: number;
  /** `false` یعنی همین سایز تمام شده و نباید انتخاب شود. */
  available?: boolean;
}

export interface MenuItem {
  id: string;
  category: MenuCategory;
  name: LocalizedText;
  description: LocalizedText;
  fullDescription: LocalizedText;
  image: string;
  imageAlt: LocalizedText;
  price: number;
  /**
   * امتیازها فقط برای آیتم‌های ثابت کاتالوگ وجود دارد؛ آیتم‌هایی که از API
   * پنل می‌آیند این فیلدها را ندارند و رابط کاربری باید آن‌ها را پنهان کند.
   */
  rating?: number;
  score?: number;
  featured?: boolean;
  ingredients: Record<Language, string[]>;
  options: Record<Language, string[]>;
  /**
   * واریانت‌های قابل انتخاب (اندازه/بسته). خالی یا تعریف‌نشده یعنی آیتم فقط یک
   * قیمت ثابت دارد و `price` همان قیمت نهایی است.
   */
  variants?: MenuItemVariant[];
  /** شناسه محصول در دیتابیس پنل (فقط برای آیتم‌های زنده API). */
  productId?: string;
  /**
   * تعداد مخلفات پیشنهادی این آیتم (نوشیدنی/ساید) که مدیر در پنل تعیین کرده
   * است. `undefined` یعنی «نامشخص» و در آن حالت پنل پیشنهاد باز نمی‌شود؛ فهرست
   * کامل مخلفات جداگانه و فقط هنگام باز شدن پنل خوانده می‌شود
   * (`fetchMenuItemAddOns`).
   */
  addOnCount?: number;
  /**
   * موجودی آیتم‌های زنده API. `undefined` یعنی «نامشخص» (آیتم‌های ثابت کاتالوگ)
   * و در آن حالت آیتم قابل سفارش در نظر گرفته می‌شود.
   */
  available?: boolean;
  stock?: number;
}

export interface BlogPost {
  id: string;
  title: LocalizedText;
  excerpt: LocalizedText;
  body: Record<Language, string[]>;
  date: LocalizedText;
  readTime: number;
  image: string;
  imageAlt: LocalizedText;
}

/**
 * یک روایت بخش «Table Talk» صفحهٔ اصلی.
 *
 * داده از `GET /api/public/testimonials` می‌آید و فقط شامل نظرهایی است که مدیر
 * در پنل «تأیید» و «نمایش در Table Talk» کرده است. متن‌ها دوزبانه‌اند: دیتابیس
 * فیلد فارسی دارد و فیلد انگلیسی اختیاری است؛ اگر ترجمه نباشد همان متن فارسی در
 * هر دو زبان نمایش داده می‌شود (نگاه کنید به `src/api/testimonials.ts`).
 */
export interface TableTalkTestimonial {
  id: string;
  /** نام نمایشی مشتری؛ خالی یعنی «مهمان» (`reviews.anonymous`). */
  name: LocalizedText;
  quote: LocalizedText;
  /** امتیاز ۱ تا ۵؛ `null` یعنی این روایت امتیاز ثبت‌شده ندارد و ستاره‌ها پنهان‌اند. */
  rating: number | null;
  /** `true` اگر شمارهٔ سفارش با یک سفارش واقعی تطابق داده شده باشد. */
  orderVerified: boolean;
  /** تاریخ ISO-8601؛ رشتهٔ خالی یعنی تاریخ نامعتبر است و نمایش داده نمی‌شود. */
  createdAt: string;
  /** نام آیتمی که نظر دربارهٔ آن است؛ `null` اگر نظر به محصولی وصل نباشد. */
  productName: string | null;
}

export interface LoyaltyTier {
  id: "bronze" | "silver" | "gold";
  name: LocalizedText;
  points: LocalizedText;
  description: LocalizedText;
  multiplier: string;
  /**
   * کمترین امتیازی که این سطح را باز می‌کند. تنها منبع حقیقت برای محاسبه سطح
   * عضو در `tierForPoints` است؛ `points` فقط متن نمایشی است.
   */
  threshold: number;
}

/* --------------------------------------------------------------------------- *
 * باشگاه مشتریان — پاسخ‌های واقعی سرور (`src/api/club.ts`)
 *
 * شکل این تایپ‌ها همان DTO سرویس باشگاه در بک‌اند است
 * (`dashboard/backend/src/services/clubService.js`)؛ هیچ امتیاز یا سطحی در
 * مرورگر محاسبه نمی‌شود و همه از همین پاسخ می‌آیند.
 * --------------------------------------------------------------------------- */

export type ClubTierId = LoyaltyTier["id"];

/** سطح فعلی عضو و فاصله تا سطح بعد؛ سرور آن را از موجودی امتیاز می‌سازد. */
export interface ClubTierSnapshot {
  id: ClubTierId;
  threshold: number;
  nextTier: ClubTierId | null;
  nextThreshold: number | null;
  pointsToNext: number;
  /** نسبت پیشرفت ۰ تا ۱ داخل سطح فعلی. */
  progress: number;
}

export interface ClubMember {
  verificationStatus: string;
  verifiedPhone: string | null;
  legacyUntil: string | null;
  id: string;
  name: string;
  /** شمارهٔ نرمال‌شده با ارقام لاتین. */
  phone: string;
  points: number;
  /** تاریخ ISO-8601. */
  joinedAt: string;
  /** تاریخ ISO-8601 یا `null` اگر ورود ثبت نشده باشد. */
  lastLoginAt: string | null;
  tier: ClubTierSnapshot;
}

/** چرا یک پاداش همین حالا قابل دریافت نیست؛ `ok` یعنی آمادهٔ استرداد. */
export type ClubRewardReason =
  | "ok"
  | "inactive"
  | "expired"
  | "out_of_stock"
  | "login_required"
  | "verification_required"
  | "tier_required"
  | "insufficient_points";

export interface ClubReward {
  id: string;
  code: string;
  titleFa: string;
  titleEn: string;
  descriptionFa: string;
  descriptionEn: string;
  costPoints: number;
  minTier: ClubTierId;
  /** `null` یعنی موجودی نامحدود. */
  stock: number | null;
  /** تاریخ ISO-8601 یا `null`. */
  expiresAt: string | null;
  canRedeem: boolean;
  reason: ClubRewardReason;
}

export type ClubTransactionType = "earn" | "redeem" | "adjust";
export type ClubTransactionSource = "order" | "review" | "reward" | "adjustment";

export interface ClubTransaction {
  status: string;
  id: string;
  type: ClubTransactionType;
  source: ClubTransactionSource;
  /** مثبت برای کسب امتیاز، منفی برای خرج کردن. */
  points: number;
  balanceAfter: number;
  /** شمارهٔ سفارش، شناسهٔ نظر یا کد پاداش؛ ممکن است خالی باشد. */
  description: string | null;
  /** تاریخ ISO-8601. */
  createdAt: string;
}

export type ClubRedemptionStatus = "pending" | "fulfilled" | "cancelled";

export interface ClubRedemption {
  id: string;
  /** کد یکتای نمایشی که برای تحویل در شعبه نشان داده می‌شود. */
  code: string;
  pointsSpent: number;
  status: ClubRedemptionStatus;
  createdAt: string;
  fulfilledAt: string | null;
  reward: { id: string; code: string; titleFa: string; titleEn: string } | null;
}

/** پاسخ `GET /api/public/club/me`؛ همهٔ داده‌های حساب در یک درخواست. */
export interface ClubDashboard {
  pendingPoints: number;
  member: ClubMember;
  transactions: ClubTransaction[];
  redemptions: ClubRedemption[];
  rewards: ClubReward[];
}

/** پاسخ استرداد؛ `duplicate` یعنی همان کلید قبلاً خرج شده و نتیجه تکرار شده است. */
export interface ClubRedemptionResult {
  duplicate: boolean;
  redemption: ClubRedemption;
  member: ClubMember | null;
}

/** یک حساب شبکه اجتماعی در فوتر سایت. */
export interface SocialLink {
  /** نام نمایشی حساب، مثل `@شیش برگر الین`. */
  handle: string;
  url: string;
  /** توضیح کوتاه برای دسترس‌پذیری و متن راهنما. */
  label: LocalizedText;
  icon: IconComponent;
}

/** نشانی‌های مکانی مغازه؛ پیش‌فرض روی میدان ونک بیرجند تنظیم شده است. */
export interface StoreLocation {
  lat: number;
  lng: number;
  /** آدرس نقشه گوگل بدون نیاز به کلید API (`...&output=embed`). */
  embedUrl: string;
  /** لینک مسیریابی گوگل‌مپ از موقعیت فعلی کاربر. */
  directionsUrl: string;
  /** لینک صفحه مکان در گوگل‌مپ. */
  placeUrl: string;
}

/* --------------------------------------------------------------------------- *
 * نظرات محصول — بخش «نظر مهمان‌ها» در صفحه محصول
 *
 * این تایپ‌ها شکل نرمال‌شدهٔ داده در سمت وب‌سایت‌اند (`src/api/reviews.ts`) و
 * مستقل از شکل خام پاسخ API هستند تا تغییر بک‌اند رابط کاربری را نشکند.
 * --------------------------------------------------------------------------- */

/** امتیاز یک نظر؛ فقط عدد صحیح ۱ تا ۵ (هم‌اندازه با ستون `rating` دیتابیس). */
export type StarRating = 1 | 2 | 3 | 4 | 5;

/** ترتیب نمایش فهرست نظرات؛ همان مقدار در پارامتر `sort` درخواست API می‌رود. */
export type ReviewSort = "newest" | "oldest" | "highest" | "lowest";

/**
 * وضعیت انتشار یک نظر.
 *
 * فهرست عمومی فقط نظرهای منتشرشده را برمی‌گرداند؛ نظر تازهٔ خودِ کاربر تا
 * تأیید تیم با `pending` نمایش داده می‌شود تا بداند ثبتش انجام شده است.
 */
export type ReviewStatus = "published" | "pending";

/** پاسخ رستوران به یک نظر (پنل مدیریت آن را ثبت می‌کند). */
export interface RestaurantReply {
  body: string;
  /** تاریخ ISO-8601. */
  createdAt: string;
}

/** یک نظر آمادهٔ نمایش روی محصول. */
export interface ProductReview {
  id: string;
  /** شناسه محصول در دیتابیس پنل (`MenuItem.productId`). */
  productId: string;
  authorName: string;
  rating: StarRating;
  /** متن نظر؛ همیشه متن ساده است (بدون HTML) و با escape خودِ React رندر می‌شود. */
  body: string;
  /** تاریخ ISO-8601. */
  createdAt: string;
  /** تصاویر پیوست؛ فقط `https://` یا مسیر نسبی مجاز است (`safeReviewImage`). */
  images: string[];
  /** `true` اگر شمارهٔ سفارش کاربر با یک سفارش واقعی تطابق داده شده باشد. */
  orderVerified: boolean;
  status: ReviewStatus;
  reply: RestaurantReply | null;
}

/** خلاصهٔ امتیازهای یک محصول؛ ورودی نمودار پراکندگی ستاره‌ها. */
export interface ReviewSummary {
  /** میانگین با یک رقم اعشار؛ صفر وقتی نظری ثبت نشده است. */
  average: number;
  /** تعداد کل نظرهای منتشرشده. */
  total: number;
  /** تعداد نظر در هر ستاره (کلیدها ۱ تا ۵). */
  distribution: Record<StarRating, number>;
}

/**
 * منشأ داده‌های نمایش‌داده‌شده.
 *
 * `api` یعنی پاسخ واقعی بک‌اند، `demo` یعنی مسیر نظرات هنوز فعال نشده و دادهٔ
 * آزمایشی نشان داده می‌شود؛ رابط کاربری در حالت `demo` بنر شفاف نمایش می‌دهد.
 */
export type ReviewSource = "api" | "demo";

/** یک صفحه از فهرست نظرات همراه با خلاصهٔ کل محصول. */
export interface ReviewPage {
  items: ProductReview[];
  /**
   * خلاصهٔ امتیازهای **کل** محصول (نه فقط همین صفحه) و مستقل از فیلترها، تا
   * میانگین و نمودار با تغییر فیلتر کاربر جابه‌جا نشوند.
   */
  summary: ReviewSummary;
  /** تعداد نظرهای منطبق با فیلتر فعلی (برای متن «N نظر» و صفحه‌بندی). */
  total: number;
  /** شمارهٔ صفحهٔ جاری (از ۱). */
  page: number;
  hasMore: boolean;
  source: ReviewSource;
}
