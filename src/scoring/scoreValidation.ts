/**
 * Checks a Stage 2 score against the dimension's actual defined bands - pure,
 * deterministic, no LLM. An illegal score (outside every band, or landing in
 * a genuine gap between bands - several small kickoff dimensions have real
 * gaps, e.g. D3's bands cover 0, 1-2, 2.5-3.5, 4.5-5, leaving 4.0 undefined)
 * gets clamped to the nearest legal boundary so the pipeline can still
 * complete - but the clamp is always recorded, never silent. Discreteness
 * (coaching's "must equal exactly one value") doesn't need a separate flag:
 * every coaching band already has min === max, so the same range check
 * already requires exact equality by construction.
 */

import type { DimensionContract } from "@/types/rubric";

export interface ScoreValidationResult {
  valid: boolean;
  rawScore: number;
  /** The score to actually use downstream - equals rawScore when valid, the nearest legal boundary when not. */
  clampedScore: number;
  /** Label of the band the (possibly clamped) score falls into. */
  matchedBand?: string;
  reason?: string;
}

export function validateDimensionScore(dimension: DimensionContract, rawScore: number): ScoreValidationResult {
  const matched = dimension.bands.find((b) => rawScore >= b.min && rawScore <= b.max);
  if (matched) {
    return { valid: true, rawScore, clampedScore: rawScore, matchedBand: matched.label };
  }

  const boundaries = dimension.bands.flatMap((b) => [b.min, b.max]);
  const nearest = boundaries.reduce((best, v) => (Math.abs(v - rawScore) < Math.abs(best - rawScore) ? v : best));
  const nearestBand = dimension.bands.find((b) => nearest >= b.min && nearest <= b.max);

  return {
    valid: false,
    rawScore,
    clampedScore: nearest,
    matchedBand: nearestBand?.label,
    reason: `${dimension.id}: score ${rawScore} doesn't fall within any defined band (max ${dimension.maxScore}) - clamped to nearest legal value ${nearest}.`,
  };
}
