/**
 * Unit tests for the pure Table Talk logic in `src/utils/tableTalk.ts`.
 *
 *   npm run test:tabletalk
 *   node --test tests/tableTalk.test.mjs
 *
 * The module under test has no React, DOM or network dependency, so Node strips
 * the type annotations natively (Node ≥ 23). `@/types` is a type-only import and
 * gets erased.
 *
 * Covered here: what the API may return (missing English translation, no rating,
 * broken rows) and the slider index maths that the UI cannot prove by hand.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  TABLE_TALK_LIMIT,
  stepTableTalkIndex,
  toLocalizedText,
  toTableTalkRating,
  toTableTalkTestimonial,
} from "../src/utils/tableTalk.ts";

/** Minimal API row; each test only states what it cares about. */
function row(overrides = {}) {
  return {
    id: "r1",
    authorName: "سارا محمودی",
    authorNameEn: "Sara M.",
    body: "سرویس سریع و برگر تازه بود.",
    bodyEn: "Fast service and a fresh burger.",
    rating: 5,
    orderVerified: true,
    createdAt: "2026-04-01T10:00:00.000Z",
    productName: "اسموکی اسمش",
    ...overrides,
  };
}

describe("toTableTalkTestimonial", () => {
  test("maps a complete API row", () => {
    const item = toTableTalkTestimonial(row());
    assert.deepEqual(item, {
      id: "r1",
      name: { fa: "سارا محمودی", en: "Sara M." },
      quote: { fa: "سرویس سریع و برگر تازه بود.", en: "Fast service and a fresh burger." },
      rating: 5,
      orderVerified: true,
      createdAt: "2026-04-01T10:00:00.000Z",
      productName: "اسموکی اسمش",
    });
  });

  test("falls back to the Persian text when there is no translation", () => {
    const item = toTableTalkTestimonial(row({ authorNameEn: "  ", bodyEn: null }));
    assert.equal(item.name.en, "سارا محمودی");
    assert.equal(item.quote.en, "سرویس سریع و برگر تازه بود.");
  });

  test("drops rows without an id or body", () => {
    for (const broken of [null, "text", 42, {}, { id: "r1" }, { body: "متن" }, { id: "", body: "متن" }]) {
      assert.equal(toTableTalkTestimonial(broken), null);
    }
  });

  test("keeps a review without a rating but hides invalid ones", () => {
    assert.equal(toTableTalkTestimonial(row({ rating: null })).rating, null);
    for (const invalid of [0, 6, 4.5, "5", Number.NaN, undefined]) {
      assert.equal(toTableTalkTestimonial(row({ rating: invalid })).rating, null);
    }
  });

  test("treats only a real boolean as a verified order", () => {
    assert.equal(toTableTalkTestimonial(row({ orderVerified: true })).orderVerified, true);
    for (const truthy of ["true", 1, {}, null, undefined]) {
      assert.equal(toTableTalkTestimonial(row({ orderVerified: truthy })).orderVerified, false);
    }
  });

  test("blanks an invalid date so the UI hides it", () => {
    assert.equal(toTableTalkTestimonial(row({ createdAt: "not-a-date" })).createdAt, "");
    assert.equal(toTableTalkTestimonial(row({ createdAt: 12345 })).createdAt, "");
  });

  test("maps an empty product name to null", () => {
    assert.equal(toTableTalkTestimonial(row({ productName: "   " })).productName, null);
    assert.equal(toTableTalkTestimonial(row({ productName: null })).productName, null);
  });
});

describe("toTableTalkRating", () => {
  test("accepts only whole stars inside 1..5", () => {
    for (const star of [1, 2, 3, 4, 5]) assert.equal(toTableTalkRating(star), star);
    for (const invalid of [0, 6, -1, 2.5, "4", null, undefined, {}]) {
      assert.equal(toTableTalkRating(invalid), null);
    }
  });
});

describe("toLocalizedText", () => {
  test("uses the Persian text for both languages when English is empty", () => {
    assert.deepEqual(toLocalizedText("متن", ""), { fa: "متن", en: "متن" });
    assert.deepEqual(toLocalizedText("متن", "text"), { fa: "متن", en: "text" });
  });
});

describe("stepTableTalkIndex", () => {
  test("wraps forwards and backwards", () => {
    assert.equal(stepTableTalkIndex(0, 3, 1), 1);
    assert.equal(stepTableTalkIndex(2, 3, 1), 0);
    assert.equal(stepTableTalkIndex(0, 3, -1), 2);
  });

  test("returns 0 for an empty or invalid list", () => {
    assert.equal(stepTableTalkIndex(4, 0, 1), 0);
    assert.equal(stepTableTalkIndex(4, -2, 1), 0);
    assert.equal(stepTableTalkIndex(4, Number.NaN, 1), 0);
  });

  test("cleans fractional and non-finite current values", () => {
    assert.equal(stepTableTalkIndex(1.7, 3, 1), 2);
    assert.equal(stepTableTalkIndex(Number.NaN, 3, 1), 1);
  });

  test("limit stays a small positive number", () => {
    assert.ok(Number.isInteger(TABLE_TALK_LIMIT) && TABLE_TALK_LIMIT > 0);
  });
});
