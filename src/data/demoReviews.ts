import type {
  Language,
  LocalizedText,
  ProductReview,
  ReviewPage,
  ReviewSort,
  StarRating,
} from "@/types";
import { filterReviews, sortReviews, summarizeReviews } from "@/utils/reviews";

/**
 * دادهٔ آزمایشی بخش نظرات محصول.
 *
 * وضعیت واقعی پروژه: بک‌اند فقط مسیر عمومی «منو» را دارد
 * (`/api/public/menu`) و مسیر نظرات محصول ساخته نشده است. طبق قرارداد این
 * تسک، رابط کاربری به‌طور کامل و واقعی پیاده‌سازی شده و تا آماده شدن
 * `GET/POST /api/public/reviews` این فهرست با **همان شکل پاسخ API** نمایش داده
 * می‌شود تا هیچ‌چیز در رابط کاربری شبیه‌سازی‌شده نماند.
 *
 * هیچ‌جای سایت این داده‌ها را «نظر واقعی مشتری» جا نمی‌زند: هر وقت
 * `ReviewPage.source === "demo"` باشد، بنر «دادهٔ آزمایشی» بالای بخش نمایش داده
 * می‌شود و متن آن صریح می‌گوید بک‌اند نظرات فعال نشده است.
 *
 * حذف کامل این حالت بعد از آماده شدن بک‌اند: راهنمای گام‌به‌گام در
 * `website/docs/reviews.md`.
 */

/** یک رکورد دادهٔ آزمایشی؛ متن‌ها دوزبانه‌اند چون رابط کاربری دوزبانه است. */
export interface DemoReviewSeed {
  id: string;
  authorName: LocalizedText;
  rating: StarRating;
  body: LocalizedText;
  /** چند روز پیش ثبت شده؛ تاریخ‌ها نسبت به «حالا» ساخته می‌شوند تا کهنه نشوند. */
  daysAgo: number;
  orderVerified?: boolean;
  /** پاسخ رستوران به این نظر (پنل مدیریت آن را ثبت می‌کند). */
  reply?: LocalizedText;
  /** نشانی تصویر پیوست (اختیاری). */
  image?: string;
}

const DAY_MS = 86_400_000;

/** تصویر نمونهٔ یک نظر؛ از همان منبع تصاویر سایت (Pexels، فقط `https`). */
const DEMO_REVIEW_IMAGE =
  "https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=640&fm=webp";

export const demoReviewSeeds: DemoReviewSeed[] = [
  {
    id: "demo-1",
    authorName: { fa: "سارا محمدی", en: "Sara M." },
    rating: 5,
    body: {
      fa: "برگر داغ و آبدار رسید؛ نانش تازه بود و بسته‌بندی هم مرتب. سس دودی‌اش دقیقاً همان طعمی است که دنبالش بودم.",
      en: "Arrived hot and juicy — the bun was fresh and the packaging spotless. That smoky sauce is exactly what I was after.",
    },
    daysAgo: 3,
    orderVerified: true,
    image: DEMO_REVIEW_IMAGE,
  },
  {
    id: "demo-2",
    authorName: { fa: "نیما رستمی", en: "Nima R." },
    rating: 5,
    body: {
      fa: "دو بار سفارش دادم و هر دو بار کیفیت ثابت بود. سیب‌زمینی‌ها حتی بعد از رسیدن ترد موندن.",
      en: "Ordered twice and the quality never dropped. The fries were still crisp by the time they arrived.",
    },
    daysAgo: 6,
    orderVerified: true,
    reply: {
      fa: "ممنون که دوباره انتخابمان کردی! تردی سیب‌زمینی برای ما مهم است و خوشحالیم که دیده شد.",
      en: "Thanks for coming back! Crisp fries matter to us, so we are glad you noticed.",
    },
  },
  {
    id: "demo-3",
    authorName: { fa: "الهام کاظمی", en: "Elham K." },
    rating: 4,
    body: {
      fa: "طعم عالی بود، فقط برای سلیقهٔ من کمی شور بود. با این حال بدون شک دوباره سفارش می‌دهم.",
      en: "Great flavour, though a touch salty for my taste. I would still order it again without hesitation.",
    },
    daysAgo: 9,
    orderVerified: true,
  },
  {
    id: "demo-5",
    authorName: { fa: "مریم بهرامی", en: "Maryam B." },
    rating: 3,
    body: {
      fa: "طعم خوب بود ولی سایز نسبت به قیمتش کوچک بود. بسته‌بندی تمیز و حرفه‌ای بود.",
      en: "Tasted good but the size felt small for the price. Packaging was clean and professional.",
    },
    daysAgo: 21,
  },
  {
    id: "demo-6",
    authorName: { fa: "رضا طاهری", en: "Reza T." },
    rating: 5,
    body: {
      fa: "ترکیب پنیر و سس مخصوص فوق‌العاده بود. یکی از بهترین برگرهایی که در بیرجند خوردم.",
      en: "The cheese and signature sauce combo is outstanding — one of the best burgers I have had in Birjand.",
    },
    daysAgo: 28,
    orderVerified: true,
    reply: {
      fa: "لطف داری رضا جان؛ سس مخصوص هر روز تازه در آشپزخانهٔ خودمان درست می‌شود.",
      en: "That is kind of you, Reza — our signature sauce is made fresh in our own kitchen every day.",
    },
  },
  {
    id: "demo-7",
    authorName: { fa: "کیانا ن.", en: "Kiana N." },
    rating: 2,
    body: {
      fa: "سفارش سرد رسید و سیب‌زمینی‌ها خمیر شده بود. پشتیبانی پیگیری کرد و جبران کردند، برای همین دوباره امتحان می‌کنم.",
      en: "It arrived cold and the fries had gone soggy. Support followed up and made it right, so I will give it another try.",
    },
    daysAgo: 35,
  },
  {
    id: "demo-8",
    authorName: { fa: "سپهر ی.", en: "Sepehr Y." },
    rating: 5,
    body: {
      fa: "بسته‌بندی حرفه‌ای، همراه دستمال و سس اضافه. جزئیات کوچک تفاوت را می‌سازد.",
      en: "Professional packaging with napkins and extra sauce included. Small details make the difference.",
    },
    daysAgo: 45,
    orderVerified: true,
  },
  {
    id: "demo-4",
    authorName: { fa: "امیر حسینی", en: "Amir H." },
    rating: 4,
    body: {
      fa: "تحویل سریع‌تر از زمان اعلام‌شده بود. پنیر کشدار و گوشت پخته و آبدار؛ تجربهٔ خوبی بود.",
      en: "Delivered faster than the estimate. Stretchy cheese and a juicy patty — a solid experience.",
    },
    daysAgo: 14,
    orderVerified: true,
  },
];

/** ورودی ساخت یک صفحهٔ دادهٔ آزمایشی با شکل پاسخ API. */
export interface DemoReviewPageInput {
  productId: string;
  language: Language;
  page: number;
  pageSize: number;
  sort: ReviewSort;
  rating: StarRating | null;
  withImagesOnly: boolean;
  /** نظرهای ثبت‌شده در همین نشست (وضعیت `pending`)؛ به فهرست اضافه می‌شوند. */
  pending?: ProductReview[];
}

/**
 * ساخت یک صفحهٔ دادهٔ آزمایشی با همان قرارداد پاسخ API.
 *
 * - خلاصهٔ امتیازها فقط از نظرهای منتشرشده حساب می‌شود؛ نظر «در انتظار تأیید»
 *   کاربر در میانگین و نمودار اثر نمی‌گذارد (همان کاری که سرور می‌کند).
 * - فیلتر، مرتب‌سازی و صفحه‌بندی هم همان رفتار سرور را دارند تا وقتی بک‌اند
 *   وصل شد، تفاوت رفتاری دیده نشود.
 */
export function buildDemoReviewPage(input: DemoReviewPageInput): ReviewPage {
  const now = Date.now();
  const published = demoReviewSeeds.map((seed) => toProductReview(seed, input.productId, input.language, now));
  const pending = input.pending ?? [];

  const matches = sortReviews(
    filterReviews([...pending, ...published], {
      rating: input.rating,
      withImagesOnly: input.withImagesOnly,
    }),
    input.sort,
  );

  const start = Math.max(0, (input.page - 1) * input.pageSize);

  return {
    items: matches.slice(start, start + input.pageSize),
    summary: summarizeReviews(published),
    total: matches.length,
    page: input.page,
    hasMore: start + input.pageSize < matches.length,
    source: "demo",
  };
}

/** تبدیل رکورد آزمایشی به `ProductReview` با تاریخ‌های نسبی به «حالا». */
function toProductReview(
  seed: DemoReviewSeed,
  productId: string,
  language: Language,
  now: number,
): ProductReview {
  return {
    id: seed.id,
    productId,
    authorName: seed.authorName[language],
    rating: seed.rating,
    body: seed.body[language],
    createdAt: new Date(now - seed.daysAgo * DAY_MS).toISOString(),
    images: seed.image ? [seed.image] : [],
    orderVerified: seed.orderVerified ?? false,
    status: "published",
    reply: seed.reply
      ? {
          body: seed.reply[language],
          createdAt: new Date(now - Math.max(seed.daysAgo - 1, 0) * DAY_MS).toISOString(),
        }
      : null,
  };
}
