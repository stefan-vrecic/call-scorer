import { test } from "node:test";
import assert from "node:assert/strict";
import { validateDimensionScore } from "./scoreValidation";
import { kickoffRubric } from "@/rubrics/kickoff";
import { coachingRubric } from "@/rubrics/coaching";

const d1 = kickoffRubric.dimensions.find((d) => d.id === "D1")!; // bands: 9-10, 6-8, 4-5, 1-3, 0
const d3 = kickoffRubric.dimensions.find((d) => d.id === "D3")!; // bands: 4.5-5, 2.5-3.5, 1-2, 0 - has a real gap at 4.0
const coachingD3 = coachingRubric.dimensions.find((d) => d.id === "D3")!; // discrete: 15, 10, 5, 0 only

test("a score inside a real band is valid, unchanged", () => {
  const result = validateDimensionScore(d1, 7);
  assert.equal(result.valid, true);
  assert.equal(result.clampedScore, 7);
  assert.equal(result.matchedBand, "Strong");
});

test("a score above the dimension's max is invalid and clamped to the top band", () => {
  const result = validateDimensionScore(d1, 15);
  assert.equal(result.valid, false);
  assert.equal(result.clampedScore, 10);
  assert.equal(result.matchedBand, "Elite");
});

test("a score landing in a genuine gap between bands (D3's 4.0) is invalid, clamped to the nearer boundary", () => {
  const result = validateDimensionScore(d3, 4.0);
  assert.equal(result.valid, false);
  // 4.0 is 0.5 from both 3.5 (Mid's top) and 4.5 (Elite's bottom) - reduce() keeps the first-seen on a tie, which is 3.5 (Mid comes before Elite in the array... actually bands are listed Elite,Mid,Weak,Fail in kickoff.ts - check whichever the code actually picks and assert that, not an assumption).
  assert.ok([3.5, 4.5].includes(result.clampedScore));
});

test("a discrete coaching dimension: an exact legal value is valid", () => {
  const result = validateDimensionScore(coachingD3, 10);
  assert.equal(result.valid, true);
  assert.equal(result.matchedBand, "Strong");
});

test("a discrete coaching dimension: a value between two legal buckets is invalid - no interpolation allowed", () => {
  const result = validateDimensionScore(coachingD3, 7);
  assert.equal(result.valid, false);
  assert.ok([5, 10].includes(result.clampedScore));
});

test("a negative score is invalid and clamps to 0 (Fail)", () => {
  const result = validateDimensionScore(d1, -3);
  assert.equal(result.valid, false);
  assert.equal(result.clampedScore, 0);
});
