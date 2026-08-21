/**
 * Builds the Stage 2 (scoring) system prompt - the opposite information cut
 * from Stage 1. Stage 1 got whatToLookFor + signals but no bands; Stage 2
 * gets the full bands/criteria/calibration notes, because judging against
 * the rubric is its entire job. What it does NOT get is the raw transcript -
 * only the validated evidence that survived Phase 3. See stage2.ts for how
 * that evidence gets attached to this prompt's user message.
 */

import type { RubricContract, DimensionContract } from "@/types/rubric";

function formatBand(band: DimensionContract["bands"][number]): string {
  const range = band.min === band.max ? `${band.min}` : `${band.min}-${band.max}`;
  return `  - ${band.label} (${range}): ${band.criteria}`;
}

function formatDimension(dimension: DimensionContract, discreteOnly: boolean): string {
  const lines = [
    `### ${dimension.id} - ${dimension.name} (max ${dimension.maxScore})`,
    `What this dimension measures: ${dimension.whatToLookFor}`,
    discreteOnly
      ? `Scoring: discrete only - your score MUST equal exactly one of the band values below. No interpolation, no value in between.`
      : `Scoring: band-based - pick any value within the matched band's range${dimension.stepSize === 0.5 ? " (half-points allowed, e.g. 4.5)" : " (whole numbers only)"}.`,
    "Bands:",
    ...dimension.bands.map(formatBand),
  ];
  if (dimension.calibrationNotes && dimension.calibrationNotes.length > 0) {
    lines.push("Calibration notes (reviewer-corrected anchors - weigh these heavily, they override a naive first reading):");
    lines.push(...dimension.calibrationNotes.map((n) => `  - ${n}`));
  }
  return lines.join("\n");
}

export function buildStage2SystemPrompt(rubric: RubricContract, disabledDimensionIds: string[]): string {
  const disabled = new Set(disabledDimensionIds);
  const scoredDimensions = rubric.dimensions.filter((d) => !disabled.has(d.id));
  const dimensionsText = scoredDimensions.map((d) => formatDimension(d, Boolean(rubric.discreteOnly))).join("\n\n");

  return `You are the scoring stage of a call-scoring pipeline for a fitness coaching company. This is Stage 2 of 2. Stage 1 already extracted evidence from the transcript - you are NOT given the raw transcript, only Stage 1's validated findings for each dimension. Your job is to judge each dimension against the rubric criteria below, using ONLY the evidence you're given.

This is a ${rubric.callType} call.

SCORING RULES:
- Base every score and every sentence of reasoning on the evidence you're given for that dimension - never introduce a claim, event, or quote that isn't in the evidence provided to you.
- When a dimension's evidence is marked insufficientEvidence: true (or the evidence array is empty), you have not been given enough to justify a high score. Score conservatively - at or near the bottom of whatever band the rubric's own language for "not observed" maps to (often Fail or the lowest band). Say so plainly in your reasoning (e.g. "No evidence provided for this dimension"). Do not invent behavior to justify a higher score.
- Quote-first reasoning: your reasoning for each dimension should reference the specific evidence you were given, not general impressions.
- Keep reasoning tight: 1-3 sentences per dimension, not a full paragraph. A reviewer needs the specific evidence-backed justification, not an essay.
- quickFix: one short, concrete sentence describing what the coach would have needed to do differently to reach full marks on this specific dimension.
- Your score for each dimension MUST be a value that is actually achievable under that dimension's bands as described below - read the band table for each dimension before scoring it.

For each dimension, report: dimensionId, score (number), reasoning, quickFix.

DIMENSIONS:

${dimensionsText}`;
}
