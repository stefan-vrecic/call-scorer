/**
 * "The one thing": the single change that moves the number most, and what the
 * call would have scored with it. Computed entirely in code - the LLM never
 * picks this, it only later writes the explanatory sentence for whichever
 * dimension this module already decided on (Phase 5's synthesis call).
 */

import { kickoffRubric } from "@/rubrics/kickoff";
import { coachingRubric } from "@/rubrics/coaching";
import type { AutomaticCap } from "@/types/rubric";
import type { CallLevelSignals } from "@/types/evaluation";
import { applyRubricRules, type ApplyRubricRulesInput } from "./applyRubricRules";

export interface OneThingCandidate {
  dimensionId: string;
  dimensionName: string;
  currentScore: number;
  potentialScore: number;
  currentTotal: number;
  potentialTotal: number;
  potentialBand: string;
  delta: number;
}

/**
 * If a cap was specifically constraining this dimension (maxDimension /
 * zeroDimension targeting it), lift that cap's signal for the hypothetical -
 * maxing the dimension out is logically inconsistent with the cap's own
 * trigger condition still being true (e.g. D4 at 15/15 Elite necessarily
 * means a North Star WAS built, so "no North Star" can no longer be true in
 * that hypothetical). Caps that constrain the total rather than one specific
 * dimension are untouched - a single dimension's fix doesn't imply anything
 * about a call-level condition like "coach speaks >75% of the call".
 */
function liftDimensionCaps(dimensionId: string, signals: CallLevelSignals, caps: AutomaticCap[]): CallLevelSignals {
  const overridden: Record<string, unknown> = { ...signals };
  for (const cap of caps) {
    if ((cap.effect.type === "maxDimension" || cap.effect.type === "zeroDimension") && cap.effect.dimensionId === dimensionId) {
      overridden[cap.signal] = !cap.firesWhenSignalIs;
    }
  }
  return overridden as CallLevelSignals;
}

/**
 * For every scored (non-disabled, not-already-maxed) dimension, simulate
 * raising it to its rubric max and recompute the total via the same
 * applyRubricRules() used for real scoring - no separate math path to drift
 * out of sync. Returned sorted by delta, largest first.
 */
export function computeOneThing(input: ApplyRubricRulesInput): OneThingCandidate[] {
  const rubric = input.callType === "kickoff" ? kickoffRubric : coachingRubric;
  const disabledIds = new Set(input.disabledDimensionIds ?? []);
  const baseline = applyRubricRules(input);

  const candidates: OneThingCandidate[] = [];

  for (const dimension of rubric.dimensions) {
    if (disabledIds.has(dimension.id)) continue;

    // Use the CAPPED/reported score, not the raw Stage-2 score - a dimension
    // can be raw-maxed by Stage 2 but still capped down in the actual report
    // (e.g. D4 scored 15/15 by Stage 2, but the "no North Star" cap holds it
    // at 10/15). That capped dimension is exactly the kind of real,
    // recoverable fix this function exists to surface - skipping it because
    // the raw score looked maxed would hide the single highest-leverage case.
    const currentScore = baseline.cappedScores[dimension.id] ?? 0;
    if (currentScore >= dimension.maxScore) continue; // already at max in the actual report - not a candidate fix

    const hypotheticalScores = { ...input.dimensionScores, [dimension.id]: dimension.maxScore };
    const hypotheticalSignals = liftDimensionCaps(dimension.id, input.signals, rubric.automaticCaps);

    const hypothetical = applyRubricRules({
      ...input,
      dimensionScores: hypotheticalScores,
      signals: hypotheticalSignals,
    });

    candidates.push({
      dimensionId: dimension.id,
      dimensionName: dimension.name,
      currentScore,
      potentialScore: dimension.maxScore,
      currentTotal: baseline.total,
      potentialTotal: hypothetical.total,
      potentialBand: hypothetical.band,
      delta: hypothetical.total - baseline.total,
    });
  }

  return candidates.sort((a, b) => b.delta - a.delta);
}

/** The winner - largest delta - or null if every scored dimension is already maxed. */
export function pickOneThing(input: ApplyRubricRulesInput): OneThingCandidate | null {
  return computeOneThing(input)[0] ?? null;
}
