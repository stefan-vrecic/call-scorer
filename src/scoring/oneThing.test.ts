import { test } from "node:test";
import assert from "node:assert/strict";
import { computeOneThing } from "./oneThing";
import type { ApplyRubricRulesInput } from "./applyRubricRules";

test("everything already maxed -> no candidates", () => {
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
  assert.equal(computeOneThing(input).length, 0);
});

test("a dimension capped down by a rule still surfaces as a candidate, using the REPORTED (capped) score - not the raw Stage 2 score", () => {
  // D4 raw-scored 15/15 by Stage 2, but the no-North-Star cap holds it to
  // 10/15 in the actual report. This is the bug that got caught: comparing
  // against the raw score would make this candidate look "already maxed"
  // and skip it, hiding the single highest-leverage fix on the call.
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
  const candidates = computeOneThing(input);
  const d4 = candidates.find((c) => c.dimensionId === "D4");
  assert.ok(d4, "D4 must appear as a candidate");
  assert.equal(d4!.currentScore, 10); // capped/reported score, not the raw 15
});

test("maxing a dimension lifts the cap that was specifically constraining it, recovering the full delta", () => {
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
  const candidates = computeOneThing(input);
  const d4 = candidates.find((c) => c.dimensionId === "D4")!;
  // Raw sum uncapped is 73 (see applyRubricRules.test.ts) - maxing D4 and
  // lifting its own cap should recover the full 73, not just clamp-and-cap again.
  assert.equal(d4.potentialTotal, 73);
  assert.equal(candidates[0].dimensionId, "D4", "D4 should be the top pick (largest delta)");
});
