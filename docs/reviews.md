# نظرات محصول — بخش «نظر مهمان‌ها»

رابط کاربری نظرات محصول کامل و واقعی پیاده‌سازی شده است، اما **مسیر عمومی نظرات در
بک‌اند هنوز ساخته نشده**. تا آماده شدن آن، درخواست‌ها به‌صورت شفاف به دادهٔ آزمایشی
برمی‌گردند و بنر «دادهٔ آزمایشی» بالای بخش نمایش داده می‌شود؛ هیچ‌جا این داده‌ها
«نظر واقعی مشتری» جا زده نمی‌شوند.

## وضعیت فعلی

| لایه | فایل | نقش |
| --- | --- | --- |
| قرارداد و درخواست | `src/api/reviews.ts` | نرمال‌سازی پاسخ، کش، حالت آزمایشی |
| منطق خالص | `src/utils/reviews.ts` | اعتبارسنجی، آمار، فیلتر/مرتب‌سازی، قالب‌بندی |
| دادهٔ آزمایشی | `src/data/demoReviews.ts` | ۸ نظر دوزبانه با شکل پاسخ API |
| وضعیت رابط | `src/hooks/useProductReviews.ts` | بارگذاری، صفحه‌بندی، ثبت نظر |
| رابط کاربری | `src/components/ReviewsSection.tsx` و بقیهٔ `Review*.tsx` | نمایش، فیلتر، فرم |
| تست | `tests/reviews.test.mjs` | `npm run test:reviews` |
| تست مرورگر | `tests/reviews.e2e.mjs` | `npm run test:reviews:e2e` |

## قرارداد API

### فهرست نظرات

```
GET /api/public/reviews?productId=<id>&page=1&pageSize=6&sort=newest&rating=5&withImages=1
```

| پارامتر | نوع | توضیح |
| --- | --- | --- |
| `productId` | string | شناسهٔ محصول در دیتابیس (`MenuItem.productId`) |
| `page` | number | از ۱؛ پیش‌فرض ۱ |
| `pageSize` | number | پیش‌فرض ۶ (`REVIEW_PAGE_SIZE`) |
| `sort` | `newest` \| `oldest` \| `highest` \| `lowest` | پیش‌فرض `newest` |
| `rating` | ۱..۵ | فقط وقتی فیلتر ست شده فرستاده می‌شود |
| `withImages` | `1` | فقط وقتی «فقط نظرهای عکس‌دار» روشن است |

پاسخ ۲۰۰:

```json
{
  "items": [
    {
      "id": "ckx_review_1",
      "productId": "ckx_product_1",
      "authorName": "سارا م.",
      "rating": 5,
      "body": "برگر داغ و آبدار رسید؛ نانش تازه بود.",
      "createdAt": "2026-03-01T10:00:00.000Z",
      "images": ["https://cdn.example.com/reviews/a.jpg"],
      "orderVerified": true,
      "status": "PUBLISHED",
      "reply": { "body": "ممنون که تجربه‌ات را گفتی!", "createdAt": "2026-03-02T09:00:00.000Z" }
    }
  ],
  "summary": {
    "average": 4.4,
    "total": 8,
    "distribution": { "1": 0, "2": 1, "3": 1, "4": 3, "5": 3 }
  },
  "total": 8,
  "page": 1,
  "hasMore": true
}
```

نکته‌های قرارداد:

- `summary` خلاصهٔ **کل** محصول است، نه همین صفحه و نه نتیجهٔ فیلتر؛ پس میانگین و
  نمودار با تغییر فیلتر کاربر جابه‌جا نمی‌شوند.
- `total` تعداد نظرهای منطبق با فیلتر فعلی است (متن «N نظر» و صفحه‌بندی از آن می‌آید).
- نام آرایه `reviews` هم پذیرفته می‌شود (اگر بک‌اند این نام را انتخاب کرد).
- رکورد ناقص (بدون `id`/`body`/امتیاز معتبر) کنار گذاشته می‌شود تا یک سطر خراب کل
  فهرست را خراب نکند.
- `status` فقط `PUBLISHED` (پیش‌فرض) یا `PENDING` است؛ فهرست عمومی باید فقط
  منتشرشده‌ها را برگرداند.

### ثبت نظر

```
POST /api/public/reviews
Content-Type: application/json
```

```json
{
  "productId": "ckx_product_1",
  "authorName": "سارا م.",
  "rating": 5,
  "body": "برگر داغ و آبدار رسید؛ نانش تازه بود.",
  "orderNumber": "WEB-123-4567"
}
```

پاسخ ۲۰۱ (یا ۲۰۰):

```json
{ "review": { "id": "ckx_review_9", "status": "PENDING" } }
```

- `orderNumber` اختیاری است و **فقط سرور** می‌تواند با تطبیق آن با سفارش واقعی،
  پرچم `orderVerified` را ست کند؛ کلاینت هرگز این کار را نمی‌کند.
- همان قواعد اعتبارسنجی کلاینت باید روی سرور هم اجرا شود: امتیاز ۱..۵، نام تا ۶۰
  نویسه، متن بین ۱۰ و ۱۰۰۰ نویسه، شمارهٔ سفارش با قالب `^[A-Z0-9]{2,4}-[A-Z0-9]{1,20}-[A-Z0-9]{4,12}$`.
- نرخ‌محدودی (rate limit) لازم است؛ فرم عمومی است و بدون احراز هویت کار می‌کند.

### چه زمانی دادهٔ آزمایشی نشان داده می‌شود؟

| حالت پاسخ | رفتار رابط کاربری |
| --- | --- |
| بدون پاسخ (شبکه/سرور قطع) | دادهٔ آزمایشی + بنر |
| `404` یا `501` (مسیر ساخته نشده) | دادهٔ آزمایشی + بنر |
| بدنهٔ غیر-JSON (هاست استاتیک `index.html` را برگردانده) | دادهٔ آزمایشی + بنر |
| `500`، `400`، نرخ‌محدودی | کارت خطا با «تلاش دوباره» |
| `200` با JSON ولی شکل نادرست | کارت خطا (قرارداد رعایت نشده و باید دیده شود) |

پرچم `demoOnly` هم برای آیتم‌های ثابت کاتالوگ (بدون `productId`) ست می‌شود؛ آن‌ها
هیچ‌وقت درخواست شبکه نمی‌فرستند و مستقیم دادهٔ آزمایشی می‌گیرند.

## امنیت و دسترس‌پذیری

- متن نظر همیشه به‌صورت متن ساده رندر می‌شود؛ هیچ‌جا `dangerouslySetInnerHTML` نیست،
  پس تگ HTML در متن کاربر بی‌اثر است.
- تصاویر پیوست از `safeReviewImage` می‌گذرند: فقط `https://` و مسیر نسبی خود سایت
  (`/uploads/...`) مجاز است؛ `javascript:`، `data:`، `http://` و `//host` رد می‌شوند.
- امتیاز فرم یک `radiogroup` بومی است (فلش‌ها جابه‌جا می‌کنند)، هر فیلد خطا
  `aria-invalid`/`aria-describedby` می‌گیرد، و تعداد نتیجهٔ فیلتر با `aria-live`
  اعلام می‌شود.
- رنگ تنها حامل اطلاعات نیست: نمودار پراکندگی ستاره‌ها عدد هر ردیف را هم می‌نویسد.

## گام‌های اتصال بک‌اند

1. مدل `Review` را در `dashboard/backend/prisma/schema.prisma` اضافه کنید (نظر، امتیاز،
   وضعیت، تصاویر، پاسخ رستوران، شمارهٔ سفارش اختیاری) و مایگریشن بگیرید.
2. کنترلر عمومی را کنار `menuController` بسازید و در `routes/public.js` ثبت کنید:
   `GET /public/reviews` و `POST /public/reviews` با همان شکل پاسخ بالا.
3. اعتبارسنجی را با همان محدوده‌های `src/utils/reviews.ts` بنویسید و نرخ‌محدودی
   بگذارید؛ پرچم `orderVerified` را فقط از تطبیق `orderNumber` با سفارش ست کنید.
4. بعد از اتصال، بخش نظرات بدون تغییر کد کار می‌کند. برای حذف کامل حالت آزمایشی:

   - در `src/api/reviews.ts`: شاخهٔ `demoOnly`، `storeDemoSubmissions`،
     `isBackendUnavailable` و بازگشت به `demoPageFor` را حذف کنید.
   - در `src/components/ReviewsSection.tsx`: بنر `source === "demo"` و پرچم
     `demoOnly` را حذف کنید.
   - `src/data/demoReviews.ts` و کلیدهای `reviews.demoNotice` / `reviews.form.demoHint`
     در `src/locales/*.json` را پاک کنید.
   - در `src/pages/ProductPage.tsx`: مقدار `reviewsDemoOnly` را حذف کنید.

## دستورها

```bash
cd website
npx tsc --noEmit            # بررسی نوع‌ها
npm run test:reviews        # تست واحد منطق نظرات (node --test)
npm run test:reviews:e2e    # ساخت + بررسی رندر بخش نظرات در کروم هدلس
npm run build               # ساخت dist
```

`test:reviews:e2e` حالت پیش‌فرض (نبود مسیر API → دادهٔ آزمایشی) را بررسی می‌کند. برای
بررسی مسیر واقعی API:

```powershell
$env:SMOKE_REVIEWS='json'; node tests/reviews.e2e.mjs
```
