import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSignalConsistency } from "./signalConsistency";
import type { DimensionValidationResult } from "./evidenceValidator";

function d10(overrides: Partial<DimensionValidationResult> = {}): DimensionValidationResult {
  return {
    dimensionId: "D10",
    observedBehaviour: "Next call is booked live with a specific date and time confirmed by both parties.",
    results: [],
    validEvidence: [{ line: 314, quote: "booking it now... there, done, it's booked." }],
    insufficientEvidence: false,
    allEvidenceRejected: false,
    ...overrides,
  };
}

test("agreement: signal true + dimension has validated evidence -> no correction", () => {
  const result = checkSignalConsistency("coaching", { nextCallBookedLive: true }, [d10()]);
  assert.equal(result.corrections.length, 0);
  assert.equal(result.correctedSignals.nextCallBookedLive, true);
});

test("agreement: signal false + dimension has no validated evidence -> no correction", () => {
  const result = checkSignalConsistency(
    "coaching",
    { nextCallBookedLive: false },
    [d10({ validEvidence: [], insufficientEvidence: true })],
  );
  assert.equal(result.corrections.length, 0);
  assert.equal(result.correctedSignals.nextCallBookedLive, false);
});

test("the real bug: signal false but D10 has real validated evidence -> corrected to true, flagged", () => {
  const result = checkSignalConsistency("coaching", { nextCallBookedLive: false }, [d10()]);
  assert.equal(result.correctedSignals.nextCallBookedLive, true);
  assert.equal(result.corrections.length, 1);
  assert.equal(result.corrections[0].signal, "nextCallBookedLive");
  assert.equal(result.corrections[0].dimensionId, "D10");
  assert.equal(result.corrections[0].reportedValue, false);
  assert.equal(result.corrections[0].correctedValue, true);
  assert.match(result.corrections[0].reason, /booking it now/);
});

test("the inverse: signal true but D10 has no validated evidence -> corrected to false, flagged", () => {
  const result = checkSignalConsistency(
    "coaching",
    { nextCallBookedLive: true },
    [d10({ validEvidence: [], insufficientEvidence: true })],
  );
  assert.equal(result.correctedSignals.nextCallBookedLive, false);
  assert.equal(result.corrections.length, 1);
});

test("evidence that was claimed but entirely rejected by Phase 3 validation still counts as no evidence", () => {
  // allEvidenceRejected case: validEvidence ends up empty even though Stage 1 claimed some.
  const result = checkSignalConsistency(
    "coaching",
    { nextCallBookedLive: true },
    [d10({ validEvidence: [], insufficientEvidence: false, allEvidenceRejected: true })],
  );
  assert.equal(result.correctedSignals.nextCallBookedLive, false);
  assert.equal(result.corrections.length, 1);
});

test("kickoff call type: the coaching-only pairing never applies, signal passes through untouched", () => {
  const result = checkSignalConsistency("kickoff", { noNorthStarStatement: true }, [
    { dimensionId: "D4", observedBehaviour: "", results: [], validEvidence: [{ line: 1, quote: "x" }], insufficientEvidence: false, allEvidenceRejected: false },
  ]);
  assert.equal(result.corrections.length, 0);
  assert.equal(result.correctedSignals.noNorthStarStatement, true);
});

test("D10 missing from the dimensions array entirely -> nothing to check, no crash", () => {
  const result = checkSignalConsistency("coaching", { nextCallBookedLive: false }, []);
  assert.equal(result.corrections.length, 0);
  assert.equal(result.correctedSignals.nextCallBookedLive, false);
});

test("signal not reported at all (undefined) -> skipped, not treated as a false disagreement", () => {
  const result = checkSignalConsistency("coaching", {}, [d10()]);
  assert.equal(result.corrections.length, 0);
  assert.equal(result.correctedSignals.nextCallBookedLive, undefined);
});
