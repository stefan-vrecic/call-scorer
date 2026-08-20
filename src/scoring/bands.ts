import type { ScoreBandDefinition } from "@/types/rubric";

/**
 * Rescales a raw total (out of maxPossible - itself derived from the sum of
 * the scored dimensions' own maxScore values, see applyRubricRules.ts) to a
 * /100 equivalent. maxPossible is 100 for kickoff and for a coaching call
 * with D4 active, so this is arithmetically a no-op there; it does real work
 * for a coaching call with D4 disabled, per the rubric's own "report the
 * result on the 100 scale" instruction.
 */
export function rescaleToHundred(rawTotal: number, maxPossible: number): number {
  if (maxPossible <= 0) return 0;
  return (rawTotal / maxPossible) * 100;
}

/**
 * Looks up the band name for a total that's already on the /100 scale.
 * Both rubrics use the same five band names, but each defines its own
 * ScoreBandDefinition[] - never assume they're interchangeable, always pass
 * the calling rubric's own bands.
 */
export function computeBand(scaledTotalOutOf100: number, scoreBands: ScoreBandDefinition[]): string {
  const sorted = [...scoreBands].sort((a, b) => a.min - b.min);

  for (const band of sorted) {
    if (scaledTotalOutOf100 >= band.min && scaledTotalOutOf100 <= band.max) {
      return band.name;
    }
  }

  // Out-of-range guard (e.g. a negative total from an aggressive cap, or a
  // total that rounds just above 100): clamp to the nearest defined band
  // rather than returning nothing - a report always needs a band.
  if (scaledTotalOutOf100 < sorted[0].min) return sorted[0].name;
  return sorted[sorted.length - 1].name;
}
