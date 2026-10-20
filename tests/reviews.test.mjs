/**
 * Unit tests for the pure review logic in `src/utils/reviews.ts`.
 *
 *   npm run test:reviews
 *   node --test tests/reviews.test.mjs
 *
 * The module under test has no React, DOM or network dependency, so it runs
 * straight in Node (Node ≥ 23 strips the type annotations natively). Only
 * `./phone.ts` is imported at runtime — hence the explicit `.ts` extension in
 * the source — while `@/types` is a type-only import that gets erased.
 *
 * What is covered here is exactly the logic the UI cannot easily prove by hand:
 * validation codes, rating maths, filter/sort order and the URL allow-list that
 * keeps `javascript:`/`data:` payloads out of an `<img src>`.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  REVIEW_MAX_BODY_LENGTH,
  REVIEW_MAX_NAME_LENGTH,
  REVIEW_MIN_BODY_LENGTH,
  averageRating,
  filterReviews,
  formatReviewDate,
  formatReviewNumber,
  hasReviewErrors,
  isValidOrderNumber,
  normalizeOrderNumber,
  ratingDistribution,
  safeReviewImage,
  sortReviews,
  starShare,
  summarizeReviews,
  toPlainText,
  toStarRating,
  validateReviewDraft,
} from "../src/utils/reviews.ts";
// امتیاز نظر سمت سرور ثبت می‌شود؛ این‌جا فقط هم‌خوانی ثابت نمایشی مهم است.
import { POINTS_PER_REVIEW } from "../src/utils/loyalty.ts";

/** Minimal review factory so each test only states what it cares about. */
function review(overrides = {}) {
  return {
    rating: 5,
    createdAt: "2026-01-01T00:00:00.000Z",
    images: [],
    ...overrides,
  };
}

describe("toStarRating", () => {
  test("keeps whole stars inside 1..5", () => {
    for (const star of [1, 2, 3, 4, 5]) {
      assert.equal(toStarRating(star), star);
    }
  });

  test("rounds fractional ratings (averages)", () => {
    assert.equal(toStarRating(4.4), 4);
    assert.equal(toStarRating(4.6), 5);
  });

  test("rejects anything outside the range or not a finite number", () => {
    for (const value of [0, 6, -1, 5.6, Number.NaN, Number.POSITIVE_INFINITY, "5", null, undefined, {}]) {
      assert.equal(toStarRating(value), null, `expected null for ${String(value)}`);
    }
  });
});

describe("toPlainText", () => {
  test("normalizes newlines and trims every line", () => {
    assert.equal(toPlainText("  a   b  \r\n  c  "), "a b\nc");
  });

  test("collapses runs of blank lines and strips control characters", () => {
    assert.equal(toPlainText("a\n\n\n\n\nb"), "a\n\nb");
    assert.equal(toPlainText("a\u0000b\u001Fc"), "abc");
  });

  test("keeps Persian text and the zero-width non-joiner intact", () => {
    const text = "نان تازه بود و سس‌اش عالی";
    assert.equal(toPlainText(text), text);
  });
});

describe("order numbers", () => {
  test("normalizes Persian digits, spaces and casing", () => {
    assert.equal(normalizeOrderNumber("  web-۱۲۳-۴۵۶۷ "), "WEB-123-4567");
  });

  test("accepts the panel format and rejects everything else", () => {
    assert.equal(isValidOrderNumber("WEB-123-4567"), true);
    assert.equal(isValidOrderNumber("ord-1-0001"), true);
    assert.equal(isValidOrderNumber("W-123-4567"), false);
    assert.equal(isValidOrderNumber("WEB-123-456"), false);
    assert.equal(isValidOrderNumber("WEB1234567"), false);
    assert.equal(isValidOrderNumber(""), false);
  });
});

describe("validateReviewDraft", () => {
  test("reports one code per invalid field and ignores an empty order number", () => {
    const errors = validateReviewDraft({ rating: null, name: "", body: "", orderNumber: "" });

    assert.equal(errors.rating, "ratingRequired");
    assert.equal(errors.name, "nameRequired");
    assert.equal(errors.body, "bodyRequired");
    assert.equal(errors.orderNumber, undefined);
    assert.equal(hasReviewErrors(errors), true);
  });

  test("enforces the shared length limits", () => {
    assert.equal(
      validateReviewDraft({
        rating: 4,
        name: "a".repeat(REVIEW_MAX_NAME_LENGTH + 1),
        body: "خوب بود ولی کمی سرد",
        orderNumber: "",
      }).name,
      "nameTooLong",
    );

    assert.equal(
      validateReviewDraft({ rating: 4, name: "سارا", body: "کوتاه", orderNumber: "" }).body,
      "bodyTooShort",
    );

    assert.equal(
      validateReviewDraft({
        rating: 4,
        name: "سارا",
        body: "ا".repeat(REVIEW_MAX_BODY_LENGTH + 1),
        orderNumber: "",
      }).body,
      "bodyTooLong",
    );

    // Boundary: exactly the minimum length is valid.
    assert.equal(
      validateReviewDraft({
        rating: 4,
        name: "سارا",
        body: "ا".repeat(REVIEW_MIN_BODY_LENGTH),
        orderNumber: "",
      }).body,
      undefined,
    );
  });

  test("flags a malformed order number but accepts a valid one", () => {
    assert.equal(
      validateReviewDraft({ rating: 5, name: "سارا", body: "عالی بود و داغ رسید", orderNumber: "nope" })
        .orderNumber,
      "orderNumberInvalid",
    );

    const errors = validateReviewDraft({
      rating: 5,
      name: "سارا",
      body: "عالی بود و داغ رسید",
      orderNumber: "WEB-123-4567",
    });

    assert.deepEqual(errors, {});
    assert.equal(hasReviewErrors(errors), false);
  });

  test("keeps the phone optional but rejects a malformed one", () => {
    const base = { rating: 5, name: "سارا", body: "عالی بود و داغ رسید", orderNumber: "" };

    // خالی بودن شماره خطا نیست؛ فرم بدون شماره هم باید ثبت شود.
    assert.equal(validateReviewDraft({ ...base, phone: "" }).phone, undefined);
    assert.equal(validateReviewDraft(base).phone, undefined);

    // ارقام فارسی و جداکننده‌ها مجازند، متن و شمارهٔ ناقص نه.
    assert.equal(validateReviewDraft({ ...base, phone: "۰۹۱۲ ۳۴۵ ۶۷۸۹" }).phone, undefined);
    assert.equal(validateReviewDraft({ ...base, phone: "0912-345-6789" }).phone, undefined);
    assert.equal(validateReviewDraft({ ...base, phone: "سلام" }).phone, "phoneInvalid");
    assert.equal(validateReviewDraft({ ...base, phone: "12345" }).phone, "phoneInvalid");
  });
});

describe("rating statistics", () => {
  test("distribution always carries all five keys", () => {
    const distribution = ratingDistribution([review({ rating: 5 }), review({ rating: 5 }), review({ rating: 3 })]);

    assert.deepEqual(distribution, { 1: 0, 2: 0, 3: 1, 4: 0, 5: 2 });
    assert.deepEqual(ratingDistribution([]), { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  });

  test("average is rounded to one decimal and empty input is zero", () => {
    assert.equal(averageRating([]), 0);
    assert.equal(averageRating([review({ rating: 5 }), review({ rating: 4 })]), 4.5);
    assert.equal(
      averageRating([review({ rating: 5 }), review({ rating: 4 }), review({ rating: 4 })]),
      4.3,
    );
  });

  test("summary counts published reviews and ignores corrupt ratings", () => {
    const summary = summarizeReviews([
      review({ rating: 5 }),
      review({ rating: 4 }),
      // A row with a broken rating must not turn the maths into NaN.
      review({ rating: 9 }),
    ]);

    assert.equal(summary.total, 3);
    assert.equal(summary.average, 3);
    assert.equal(summary.distribution[5], 1);
  });

  test("star share is a 0..100 percentage and never divides by zero", () => {
    assert.equal(starShare(2, 4), 50);
    assert.equal(starShare(1, 3), 33);
    assert.equal(starShare(0, 0), 0);
  });
});

describe("filterReviews", () => {
  const list = [
    review({ rating: 5, createdAt: "2026-03-01T00:00:00.000Z", images: ["https://cdn.test/a.jpg"] }),
    review({ rating: 3, createdAt: "2026-02-01T00:00:00.000Z" }),
    review({ rating: 5, createdAt: "2026-01-01T00:00:00.000Z" }),
  ];

  test("filters by stars, by attached images, and by both together", () => {
    assert.equal(filterReviews(list, { rating: 5 }).length, 2);
    assert.equal(filterReviews(list, { withImagesOnly: true }).length, 1);
    assert.equal(filterReviews(list, { rating: 5, withImagesOnly: true }).length, 1);
    assert.equal(filterReviews(list, { rating: 3, withImagesOnly: true }).length, 0);
  });

  test("passing no options returns the list untouched", () => {
    assert.deepEqual(filterReviews(list, {}), list);
  });
});

describe("sortReviews", () => {
  const list = [
    review({ rating: 3, createdAt: "2026-02-01T00:00:00.000Z" }),
    review({ rating: 5, createdAt: "2026-01-01T00:00:00.000Z" }),
    review({ rating: 5, createdAt: "2026-03-01T00:00:00.000Z" }),
  ];

  test("orders by date and by rating", () => {
    assert.deepEqual(
      sortReviews(list, "newest").map((item) => item.createdAt),
      ["2026-03-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"],
    );
    assert.deepEqual(
      sortReviews(list, "oldest").map((item) => item.createdAt),
      ["2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z", "2026-03-01T00:00:00.000Z"],
    );
    assert.deepEqual(sortReviews(list, "highest").map((item) => item.rating), [5, 5, 3]);
    assert.deepEqual(sortReviews(list, "lowest").map((item) => item.rating), [3, 5, 5]);
  });

  test("does not mutate the input array", () => {
    const snapshot = list.map((item) => item.createdAt);
    sortReviews(list, "highest");
    assert.deepEqual(list.map((item) => item.createdAt), snapshot);
  });
});

describe("formatting", () => {
  test("dates are localized and an invalid date yields an empty string", () => {
    assert.equal(formatReviewDate("not-a-date", "fa"), "");
    assert.equal(formatReviewDate("", "en"), "");
    assert.notEqual(formatReviewDate("2026-01-05T10:00:00.000Z", "en"), "");
    assert.notEqual(formatReviewDate("2026-01-05T10:00:00.000Z", "fa"), "");
  });

  test("numbers use the digits of the active language", () => {
    assert.equal(formatReviewNumber(5, "en"), "5");
    assert.match(formatReviewNumber(5, "fa"), /^[\u06F0-\u06F9]$/);
    assert.doesNotMatch(formatReviewNumber(1234, "fa"), /\d/);
  });
});

describe("safeReviewImage", () => {
  test("allows https and same-site relative paths", () => {
    assert.equal(safeReviewImage("https://cdn.example.com/a.jpg"), "https://cdn.example.com/a.jpg");
    assert.equal(safeReviewImage("  /uploads/reviews/a.jpg  "), "/uploads/reviews/a.jpg");
  });

  test("blocks script, data, insecure and protocol-relative URLs", () => {
    for (const value of [
      "javascript:alert(1)",
      "data:image/svg+xml;base64,PHN2Zz4=",
      "http://cdn.example.com/a.jpg",
      "//evil.example.com/a.jpg",
      "",
      "   ",
      "ftp://cdn.example.com/a.jpg",
    ]) {
      assert.equal(safeReviewImage(value), null, `expected null for ${value}`);
    }
  });
});

describe("review points constant", () => {
  test("stays synced with the server reward amount", () => {
    // مقدار سرور در `dashboard/backend/src/services/clubService.js` تعریف شده
    // است؛ تغییر ناخواستهٔ ثابت نمایشی باید همین‌جا دیده شود.
    assert.equal(POINTS_PER_REVIEW, 50);
  });
});
