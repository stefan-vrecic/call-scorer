import { coachingRubric } from "@/rubrics/coaching";
import type { CallLevelSignals } from "@/types/evaluation";
import { applyCaps, type CapApplicationResult } from "./capEngine";

/** Applies the coaching rubric's 6 automatic caps to a set of dimension scores. */
export function applyCoachingCaps(
  dimensionScores: Record<string, number>,
  signals: CallLevelSignals,
): CapApplicationResult {
  return applyCaps(dimensionScores, signals, coachingRubric.automaticCaps);
}
