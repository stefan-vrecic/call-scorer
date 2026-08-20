/**
 * Shared entry point: dimension scores + call-level signals in, deterministic
 * total/band/caps out. Dispatches to the rubric-specific cap functions but
 * owns the total/rescale/band logic itself, since that part genuinely is the
 * same shape for both rubrics (only the caps and the /85 rescale trigger differ).
 */

import { kickoffRubric } from "@/rubrics/kickoff";
import { coachingRubric } from "@/rubrics/coaching";
import type { CallType } from "@/types/rubric";
import type { CallLevelSignals } from "@/types/evaluation";
import { applyKickoffCaps } from "./kickoffCaps";
import { applyCoachingCaps } from "./coachingCaps";
import { rescaleToHundred, computeBand } from "./bands";
import type { AppliedCapRecord } from "./capEngine";

export interface ApplyRubricRulesInput {
  callType: CallType;
  /** dimensionId -> Stage 2 score. Include a 0 (not a missing key) for a dimension that scored 0. */
  dimensionScores: Record<string, number>;
  signals: CallLevelSignals;
  /** Coaching only: dimension ids switched off this run (in practice just ["D4"] or []). */
  disabledDimensionIds?: string[];
}

export interface ApplyRubricRulesResult {
  cappedScores: Record<string, number>;
  cappedDimensionIds: Record<string, string>;
  appliedCaps: AppliedCapRecord[];
  /** Sum of (capped) dimension scores, out of maxPossible - not yet rescaled to /100. */
  rawTotal: number;
  /** 100, or 85 for a coaching call with D4 disabled. */
  maxPossible: number;
  /**
   * Final reported total, always on the /100 scale per both rubrics'
   * "report the result on the 100 scale" convention - this is the number the
   * report's headline grade shows.
   *
   * DECISION (the source rubric doesn't address this interaction): maxTotal
   * caps are applied to the rescaled /100 total, not the raw pre-rescale
   * total. The caps table's plain-English "Max 75 total" reads as a cap on
   * the reported grade, and the reported grade is always the /100 figure -
   * so a cap firing on a D4-disabled coaching call caps the already-rescaled
   * number, not the raw 85-point one.
   */
  total: number;
  band: string;
}

export function applyRubricRules(input: ApplyRubricRulesInput): ApplyRubricRulesResult {
  const rubric = input.callType === "kickoff" ? kickoffRubric : coachingRubric;

  const capResult =
    input.callType === "kickoff"
      ? applyKickoffCaps(input.dimensionScores, input.signals)
      : applyCoachingCaps(input.dimensionScores, input.signals);

  const disabledIds = new Set(input.disabledDimensionIds ?? []);
  const scoredDimensions = rubric.dimensions.filter((d) => !disabledIds.has(d.id));

  const rawTotal = scoredDimensions.reduce((sum, d) => sum + (capResult.cappedScores[d.id] ?? 0), 0);

  // DECISION: maxPossible is the sum of the actually-scored dimensions' own
  // maxScore values, not rubric.totalPoints/reducedTotalPoints. On the
  // coaching rubric these disagree - its 12 dimensions' individual point
  // values literally sum to 105 (not the 100 its own scope note claims), and
  // 105 minus D4's 15 is 90 (not the stated 85). Trusting the stated 100/85
  // would let a coach who maxes every dimension show up as "105/100" - an
  // impossible, visibly broken total. The per-dimension tables are the actual
  // scoring instructions; deriving from them keeps a perfect call at exactly
  // 100/100 no matter which number the rubric's summary line claims. See the
  // comment in src/rubrics/coaching.ts for the full discrepancy.
  const maxPossible = scoredDimensions.reduce((sum, d) => sum + d.maxScore, 0);

  const scaledTotal = rescaleToHundred(rawTotal, maxPossible);
  const total = capResult.totalCapValue !== null ? Math.min(scaledTotal, capResult.totalCapValue) : scaledTotal;
  const band = computeBand(total, rubric.scoreBands);

  return {
    cappedScores: capResult.cappedScores,
    cappedDimensionIds: capResult.cappedDimensionIds,
    appliedCaps: capResult.appliedCaps,
    rawTotal,
    maxPossible,
    total,
    band,
  };
}
