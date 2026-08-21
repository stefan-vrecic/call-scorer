/**
 * Orchestrates the full deterministic scoring path: transcript -> Stage 1 ->
 * validate -> Stage 2 (on validated evidence only) -> score-validate/clamp ->
 * applyRubricRules -> oneThing. Returns everything a Report needs except
 * brief/redFlags, which Phase 5's synthesis call fills in - this function
 * doesn't change shape when that's added, it just gets one more step
 * appended after it.
 */

import { kickoffRubric } from "@/rubrics/kickoff";
import { coachingRubric } from "@/rubrics/coaching";
import type { CallType } from "@/types/rubric";
import { runStage1 } from "./stage1";
import { validateStage1Output, type Stage1ValidationResult } from "./evidenceValidator";
import { runStage2 } from "./stage2";
import { validateDimensionScore } from "@/scoring/scoreValidation";
import { applyRubricRules } from "@/scoring/applyRubricRules";
import { computeOneThing } from "@/scoring/oneThing";
import { MODEL } from "@/config";
import type { Report, ReportDimension } from "@/types/report";

export type PartialReport = Omit<Report, "brief" | "redFlags">;

function getDisabledDimensionIds(callType: CallType, validation: Stage1ValidationResult): string[] {
  if (callType !== "coaching") return [];
  return validation.signals.movementCoachingDisabled ? ["D4"] : [];
}

export async function runScoringPipeline(callType: CallType, transcript: string): Promise<PartialReport> {
  const rubric = callType === "kickoff" ? kickoffRubric : coachingRubric;

  const { output: stage1Output, indexed } = await runStage1(callType, transcript);
  const validation = validateStage1Output(stage1Output, indexed);

  if (validation.summary.fail) {
    throw new Error(
      `Evidence validation failed: ${validation.summary.invalidEvidence}/${validation.summary.totalEvidence} citations invalid (${(validation.summary.invalidRate * 100).toFixed(1)}%) - exceeds the fail threshold. This run cannot be trusted.`,
    );
  }

  const disabledDimensionIds = getDisabledDimensionIds(callType, validation);
  const scoredDimensions = validation.dimensions.filter((d) => !disabledDimensionIds.includes(d.dimensionId));

  const stage2Output = await runStage2(callType, scoredDimensions, disabledDimensionIds);
  const stage2ByDimension = new Map(stage2Output.dimensions.map((d) => [d.dimensionId, d]));

  const dimensionScores: Record<string, number> = {};
  const scoreClampReasons: Record<string, string> = {};

  for (const dim of rubric.dimensions) {
    if (disabledDimensionIds.includes(dim.id)) continue;
    const stage2Result = stage2ByDimension.get(dim.id);
    if (!stage2Result) {
      throw new Error(`Stage 2 did not return a score for ${dim.id} - expected one for every non-disabled dimension.`);
    }
    const validated = validateDimensionScore(dim, stage2Result.score);
    dimensionScores[dim.id] = validated.clampedScore;
    if (!validated.valid && validated.reason) {
      scoreClampReasons[dim.id] = validated.reason;
    }
  }

  const rulesInput = {
    callType,
    dimensionScores,
    signals: validation.signals,
    disabledDimensionIds,
  };

  const ruleResult = applyRubricRules(rulesInput);
  const oneThingCandidates = computeOneThing(rulesInput);
  const topCandidate = oneThingCandidates[0];

  const dimensions: ReportDimension[] = rubric.dimensions.map((dim) => {
    const isDisabled = disabledDimensionIds.includes(dim.id);
    if (isDisabled) {
      return {
        id: dim.id,
        name: dim.name,
        maxScore: dim.maxScore,
        score: null,
        reasoning: "",
        quickFix: "",
        evidence: [],
        observedBehaviour: validation.signals.movementCoachingDisabledReason ?? "",
        insufficientEvidence: false,
        disabled: true,
        disabledReason: validation.signals.movementCoachingDisabledReason,
      };
    }

    const validationResult = validation.dimensions.find((d) => d.dimensionId === dim.id)!;
    const stage2Result = stage2ByDimension.get(dim.id)!;

    return {
      id: dim.id,
      name: dim.name,
      maxScore: dim.maxScore,
      score: ruleResult.cappedScores[dim.id] ?? null,
      reasoning: stage2Result.reasoning,
      quickFix: stage2Result.quickFix,
      evidence: validationResult.validEvidence,
      observedBehaviour: validationResult.observedBehaviour,
      insufficientEvidence: validationResult.insufficientEvidence,
      disabled: false,
      cappedBy: ruleResult.cappedDimensionIds[dim.id],
      scoreClampReason: scoreClampReasons[dim.id],
    };
  });

  return {
    callType,
    model: MODEL,
    dimensions,
    appliedCaps: ruleResult.appliedCaps,
    rawTotal: ruleResult.rawTotal,
    total: ruleResult.total,
    maxPossible: ruleResult.maxPossible,
    band: ruleResult.band,
    oneThing: topCandidate
      ? {
          dimensionId: topCandidate.dimensionId,
          dimensionName: topCandidate.dimensionName,
          currentScore: topCandidate.currentScore,
          potentialScore: topCandidate.potentialScore,
          currentTotal: topCandidate.currentTotal,
          potentialTotal: topCandidate.potentialTotal,
          potentialBand: topCandidate.potentialBand,
          // Interim, deterministic explanation until Phase 5's synthesis call writes a real one -
          // the dimension's own quickFix is already a true, grounded answer to "what needed to change."
          explanation: stage2ByDimension.get(topCandidate.dimensionId)?.quickFix ?? "",
        }
      : null,
    evidenceWarning: validation.summary.warning,
    generatedAt: new Date().toISOString(),
  };
}
