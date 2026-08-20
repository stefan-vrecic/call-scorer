import { kickoffRubric } from "@/rubrics/kickoff";
import type { CallLevelSignals } from "@/types/evaluation";
import { applyCaps, type CapApplicationResult } from "./capEngine";

/** Applies the kick-off rubric's 4 automatic caps to a set of dimension scores. */
export function applyKickoffCaps(
  dimensionScores: Record<string, number>,
  signals: CallLevelSignals,
): CapApplicationResult {
  return applyCaps(dimensionScores, signals, kickoffRubric.automaticCaps);
}
