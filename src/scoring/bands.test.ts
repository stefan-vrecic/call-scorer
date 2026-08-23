import { test } from "node:test";
import assert from "node:assert/strict";
import { rescaleToHundred, computeBand } from "./bands";

// Found by actually rendering a real PDF and looking at it (see ENGINEERING_LOG),
// not by code review: a coaching call with D4 disabled rescales /90 -> /100, and
// 77/90*100 is a repeating decimal (85.55555555555556). Nothing rounded it before
// display, so it rendered exactly that ugly, straight to the coach reading the
// report - in both the web report and the PDF, since neither renderer formats the
// number itself, they just interpolate whatever rescaleToHundred() returns.

test("rescaleToHundred rounds to 1 decimal - the exact case that shipped unrounded", () => {
  assert.equal(rescaleToHundred(77, 90), 85.6);
});

test("rescaleToHundred is a no-op (still 1-decimal-clean) when maxPossible is already 100", () => {
  assert.equal(rescaleToHundred(66.5, 100), 66.5);
  assert.equal(rescaleToHundred(100, 100), 100);
});

test("rescaleToHundred handles a zero/negative maxPossible without dividing by zero", () => {
  assert.equal(rescaleToHundred(50, 0), 0);
  assert.equal(rescaleToHundred(50, -5), 0);
});

test("rescaleToHundred rounds, doesn't truncate - 84.444...4 rounds down, 85.55...6 rounds up", () => {
  assert.equal(rescaleToHundred(76, 90), 84.4);
  assert.equal(rescaleToHundred(77, 90), 85.6);
});

const BANDS = [
  { name: "Elite", min: 90, max: 100 },
  { name: "Strong", min: 80, max: 89 },
  { name: "Inconsistent", min: 70, max: 79 },
  { name: "At Risk", min: 60, max: 69 },
  { name: "Fail", min: 0, max: 59 },
];

test("computeBand finds the containing band for a rounded, mid-band total", () => {
  assert.equal(computeBand(85.6, BANDS), "Strong");
});

test("computeBand clamps below the lowest band's min to the lowest band, not undefined", () => {
  assert.equal(computeBand(-5, BANDS), "Fail");
});

test("computeBand clamps above the highest band's max to the highest band, not undefined", () => {
  assert.equal(computeBand(103, BANDS), "Elite");
});
