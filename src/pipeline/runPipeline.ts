/**
 * Orchestrates the full pipeline: transcript -> Stage 1 -> validate ->
 * Stage 2 (on validated evidence only) -> score-validate/clamp ->
 * applyRubricRules -> oneThing (all deterministic) -> synthesis (brief,
 * redFlags, oneThingExplanation - strictly downstream, see synthesis.ts).
 * Returns a complete Report.
 */

import { kickoffRubric } from "@/rubrics/kickoff";
import { coachingRubric } from "@/rubrics/coaching";
import type { CallType } from "@/types/rubric";
import { runStage1 } from "./stage1";
import { validateStage1Output, type Stage1ValidationResult } from "./evidenceValidator";
import { runStage2 } from "./stage2";
import { checkSignalConsistency } from "./signalConsistency";
import { validateDimensionScore } from "@/scoring/scoreValidation";
import { applyRubricRules } from "@/scoring/applyRubricRules";
import { computeOneThing } from "@/scoring/oneThing";
import { runSynthesis, type OneThingCandidate } from "./synthesis";
import { MODEL } from "@/config";
import type { Report, ReportDimension } from "@/types/report";

/**
 * The 3 real LLM calls a run goes through, in order - the single source of
 * truth for both the DB's `stage` check constraint (db/schema.sql) and the
 * run page's progress indicator (src/app/runs/[id]/page.tsx). Deterministic
 * steps (validation, caps, oneThing) aren't included - they're sub-millisecond
 * and not worth a progress step of their own.
 */
export const PIPELINE_STAGES = ["extracting_evidence", "scoring", "summarizing"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export interface PipelineHooks {
  /** Called right before each real API call starts. Never called for deterministic steps. */
  onStageChange?: (stage: PipelineStage) => void | Promise<void>;
}

function getDisabledDimensionIds(callType: CallType, signals: Stage1ValidationResult["signals"]): string[] {
  if (callType !== "coaching") return [];
  return signals.movementCoachingDisabled ? ["D4"] : [];
}

export async function runScoringPipeline(
  callType: CallType,
  transcript: string,
  hooks: PipelineHooks = {},
): Promise<Report> {
  const rubric = callType === "kickoff" ? kickoffRubric : coachingRubric;

  await hooks.onStageChange?.("extracting_evidence");
  const { output: stage1Output, indexed } = await runStage1(callType, transcript);
  const validation = validateStage1Output(stage1Output, indexed, rubric);

  if (validation.summary.fail) {
    throw new Error(
      `Evidence validation failed: ${validation.summary.invalidEvidence}/${validation.summary.totalEvidence} citations invalid (${(validation.summary.invalidRate * 100).toFixed(1)}%) - exceeds the fail threshold. This run cannot be trusted.`,
    );
  }

  // Corrects any call-level signal that contradicts its paired dimension's own
  // validated evidence (see signalConsistency.ts) - runs before the signals are
  // used for anything downstream (disabled-dimension check, caps, oneThing).
  const { correctedSignals, corrections: signalCorrections } = checkSignalConsistency(
    callType,
    validation.signals,
    validation.dimensions,
  );

  const disabledDimensionIds = getDisabledDimensionIds(callType, correctedSignals);
  const scoredDimensions = validation.dimensions.filter((d) => !disabledDimensionIds.includes(d.dimensionId));

  await hooks.onStageChange?.("scoring");
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
    signals: correctedSignals,
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

  const oneThingCandidate: OneThingCandidate | null = topCandidate
    ? {
        dimensionId: topCandidate.dimensionId,
        dimensionName: topCandidate.dimensionName,
        currentScore: topCandidate.currentScore,
        potentialScore: topCandidate.potentialScore,
        currentTotal: topCandidate.currentTotal,
        potentialTotal: topCandidate.potentialTotal,
        potentialBand: topCandidate.potentialBand,
      }
    : null;

  // Everything above this point is final - synthesis only writes prose describing it
  // (see synthesis.ts's docstring for why it can't alter any of it).
  await hooks.onStageChange?.("summarizing");
  const synthesis = await runSynthesis({
    callType,
    dimensions,
    rawTotal: ruleResult.rawTotal,
    total: ruleResult.total,
    maxPossible: ruleResult.maxPossible,
    band: ruleResult.band,
    appliedCaps: ruleResult.appliedCaps,
    oneThingCandidate,
    signalCorrections,
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
    oneThing: oneThingCandidate
      ? {
          ...oneThingCandidate,
          // Written by synthesis, grounded in the same final numbers above - never the dimension's own quickFix verbatim.
          explanation: synthesis.oneThingExplanation ?? "",
        }
      : null,
    evidenceWarning: validation.summary.warning,
    signalCorrections,
    signalEvidenceIssues: validation.signalEvidenceIssues,
    brief: synthesis.brief,
    redFlags: synthesis.redFlags,
    generatedAt: new Date().toISOString(),
  };
}
