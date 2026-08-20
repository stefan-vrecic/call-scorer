/**
 * Generic cap-application engine, shared by kickoffCaps.ts and coachingCaps.ts.
 *
 * This is deliberately the ONE place clamping logic lives. The two rubrics'
 * caps differ in which conditions exist and what they affect (data, defined
 * per-rubric in src/rubrics/*.ts) - but "how a maxTotal/maxDimension/
 * zeroDimension effect gets applied once its condition is true" is the same
 * mechanical operation either way, so it isn't duplicated per rubric.
 */

import type { AutomaticCap } from "@/types/rubric";

export interface AppliedCapRecord {
  id: string;
  condition: string;
  effect: AutomaticCap["effect"];
}

export interface CapApplicationResult {
  /** Dimension scores after maxDimension/zeroDimension effects are applied. */
  cappedScores: Record<string, number>;
  /** dimensionId -> id of the cap that constrained it, for dimensions a cap touched. */
  cappedDimensionIds: Record<string, string>;
  /** Every cap whose condition was true, in rubric order. */
  appliedCaps: AppliedCapRecord[];
  /** The strictest (lowest) maxTotal value among fired caps, or null if none fired. */
  totalCapValue: number | null;
}

/**
 * Whether a cap fires, given the signal value Stage 1 reported.
 *
 * A signal Stage 1 didn't report (undefined) defaults to "cap does not fire" -
 * conservative in the coach's favour, consistent with the rubrics' own
 * "conservative on missing evidence" principle. A cap should fire because a
 * bad thing was observed, not because a signal happened to be missing.
 */
function capFires(cap: AutomaticCap, signalValue: unknown): boolean {
  if (typeof signalValue !== "boolean") return false;
  return signalValue === cap.firesWhenSignalIs;
}

export function applyCaps(
  dimensionScores: Record<string, number>,
  signals: Record<string, unknown>,
  caps: AutomaticCap[],
): CapApplicationResult {
  const cappedScores: Record<string, number> = { ...dimensionScores };
  const cappedDimensionIds: Record<string, string> = {};
  const appliedCaps: AppliedCapRecord[] = [];
  let totalCapValue: number | null = null;

  for (const cap of caps) {
    if (!capFires(cap, signals[cap.signal])) continue;

    appliedCaps.push({ id: cap.id, condition: cap.condition, effect: cap.effect });

    switch (cap.effect.type) {
      case "maxDimension": {
        const { dimensionId, value } = cap.effect;
        if (cappedScores[dimensionId] === undefined) break;
        if (cappedScores[dimensionId] > value) {
          cappedScores[dimensionId] = value;
        }
        cappedDimensionIds[dimensionId] = cappedDimensionIds[dimensionId] ?? cap.id;
        break;
      }
      case "zeroDimension": {
        const { dimensionId } = cap.effect;
        cappedScores[dimensionId] = 0;
        cappedDimensionIds[dimensionId] = cap.id;
        break;
      }
      case "maxTotal": {
        totalCapValue = totalCapValue === null ? cap.effect.value : Math.min(totalCapValue, cap.effect.value);
        break;
      }
    }
  }

  return { cappedScores, cappedDimensionIds, appliedCaps, totalCapValue };
}
