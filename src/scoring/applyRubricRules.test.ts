import { test } from "node:test";
import assert from "node:assert/strict";
import { applyRubricRules, type ApplyRubricRulesInput } from "./applyRubricRules";

test("kickoff: perfect call maxes every dimension, no caps, total 100, band Elite", () => {
  const input: ApplyRubricRulesInput = {
    callType: "kickoff",
    dimensionScores: { D1: 10, D2: 10, D3: 5, D4: 15, D5: 10, D6: 10, D7: 5, D8: 10, D9: 10, D10: 5, D11: 5, D12: 5 },
    signals: {
      noFollowUpQuestionsAnywhere: false,
      coachDominatesWithoutEngagement: false,
      clientUnresolvedConfusion: false,
      noNorthStarStatement: false,
    },
  };
  const result = applyRubricRules(input);
  assert.equal(result.rawTotal, 100);
  assert.equal(result.total, 100);
  assert.equal(result.band, "Elite");
  assert.equal(result.appliedCaps.length, 0);
});

test("kickoff: no-North-Star cap clamps D4 to 10 even though Stage 2 scored it 15", () => {
  // Sum before cap: 7+7+3.5+15+7+7+3+7+7+3.5+3+3 = 73. After cap (D4 15 -> 10): 68.
  const input: ApplyRubricRulesInput = {
    callType: "kickoff",
    dimensionScores: { D1: 7, D2: 7, D3: 3.5, D4: 15, D5: 7, D6: 7, D7: 3, D8: 7, D9: 7, D10: 3.5, D11: 3, D12: 3 },
    signals: {
      noFollowUpQuestionsAnywhere: false,
      coachDominatesWithoutEngagement: false,
      clientUnresolvedConfusion: false,
      noNorthStarStatement: true,
    },
  };
  const result = applyRubricRules(input);
  assert.equal(result.cappedScores.D4, 10);
  assert.equal(result.cappedDimensionIds.D4, "no-north-star");
  assert.equal(result.rawTotal, 68);
  assert.equal(result.total, 68);
  assert.equal(result.band, "At Risk");
  assert.deepEqual(result.appliedCaps.map((c) => c.id), ["no-north-star"]);
});

test("kickoff: a fired maxDimension cap that doesn't actually bind (score already below the ceiling) is listed in appliedCaps but NOT recorded as cappedBy on the dimension", () => {
  // Found via a real pipeline run: D4 raw-scored 5 by Stage 2 (already below
  // the no-North-Star cap's ceiling of 10). The cap's condition IS true, so
  // it belongs in appliedCaps - but reporting cappedBy on D4 too would
  // falsely tell a coach they lost points to this rule when the score would
  // have been identical without it.
  const input: ApplyRubricRulesInput = {
    callType: "kickoff",
    dimensionScores: { D1: 8, D2: 7, D3: 3.5, D4: 5, D5: 7, D6: 7, D7: 5, D8: 7, D9: 10, D10: 1, D11: 3, D12: 4.5 },
    signals: {
      noFollowUpQuestionsAnywhere: false,
      coachDominatesWithoutEngagement: false,
      clientUnresolvedConfusion: false,
      noNorthStarStatement: true,
    },
  };
  const result = applyRubricRules(input);
  assert.equal(result.cappedScores.D4, 5); // unchanged - 5 was already below the cap's ceiling of 10
  assert.deepEqual(result.appliedCaps.map((c) => c.id), ["no-north-star"]); // condition still true, still listed
  assert.equal(result.cappedDimensionIds.D4, undefined); // but NOT flagged as capped on the dimension itself
});

test("kickoff: no-follow-up-questions maxTotal cap holds the total at 70 despite a higher raw sum", () => {
  // Sum: 9+7+4.5+10+8+7+5+7+7+4.5+5+4.5 = 78.5 -> capped to 70.
  const input: ApplyRubricRulesInput = {
    callType: "kickoff",
    dimensionScores: { D1: 9, D2: 7, D3: 4.5, D4: 10, D5: 8, D6: 7, D7: 5, D8: 7, D9: 7, D10: 4.5, D11: 5, D12: 4.5 },
    signals: {
      noFollowUpQuestionsAnywhere: true,
      coachDominatesWithoutEngagement: false,
      clientUnresolvedConfusion: false,
      noNorthStarStatement: false,
    },
  };
  const result = applyRubricRules(input);
  assert.equal(result.rawTotal, 78.5);
  assert.equal(result.total, 70);
  assert.equal(result.band, "Inconsistent");
  assert.deepEqual(result.appliedCaps.map((c) => c.id), ["no-follow-up-questions"]);
});

test("coaching: D4 disabled derives maxPossible from the other 11 dimensions (90), not the rubric's stated 85", () => {
  const input: ApplyRubricRulesInput = {
    callType: "coaching",
    dimensionScores: { D1: 10, D2: 7, D3: 15, D4: 0, D5: 10, D6: 10, D7: 5, D8: 5, D9: 3, D10: 5, D11: 3, D12: 3 },
    signals: {
      nextCallBookedLive: true,
      longTermVisionConnected: true,
      coachSpeaksOver75PctPassiveClient: false,
      concreteAccountabilityCommitmentPresent: true,
      struggleIgnoredOrAvoided: false,
      noActionStepsEitherParty: false,
    },
    disabledDimensionIds: ["D4"],
  };
  const result = applyRubricRules(input);
  assert.equal(result.rawTotal, 76); // 10+7+15+10+10+5+5+3+5+3+3
  assert.equal(result.maxPossible, 90);
  // 76/90*100 = 84.44444444444444... - rescaleToHundred() rounds to 1 decimal
  // (see bands.ts) specifically so this doesn't render as a repeating decimal
  // straight to a coach reading the report - assert the clean value directly.
  assert.equal(result.total, 84.4);
});

test("coaching: next call not booked live forces D10 to 0, non-recoverable, regardless of Stage 2's raw score", () => {
  const input: ApplyRubricRulesInput = {
    callType: "coaching",
    dimensionScores: { D1: 10, D2: 10, D3: 15, D4: 15, D5: 10, D6: 15, D7: 5, D8: 5, D9: 5, D10: 5, D11: 5, D12: 5 },
    signals: {
      nextCallBookedLive: false,
      longTermVisionConnected: true,
      coachSpeaksOver75PctPassiveClient: false,
      concreteAccountabilityCommitmentPresent: true,
      struggleIgnoredOrAvoided: false,
      noActionStepsEitherParty: false,
    },
  };
  const result = applyRubricRules(input);
  assert.equal(result.cappedScores.D10, 0);
  assert.equal(result.cappedDimensionIds.D10, "next-call-not-booked-live");
  assert.equal(result.maxPossible, 105); // all 12 dims active, derived - not the rubric's stated 100
  assert.equal(result.rawTotal, 100); // 105 raw-maxed, minus D10's 5
  // 100/105*100 = 95.23809523809524... - rescaleToHundred() rounds to 1 decimal (see bands.ts).
  assert.equal(result.total, 95.2);
  assert.equal(result.band, "Elite");
});
