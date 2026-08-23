import type { ScoreBandDefinition } from "@/types/rubric";

/**
 * Rescales a raw total (out of maxPossible - itself derived from the sum of
 * the scored dimensions' own maxScore values, see applyRubricRules.ts) to a
 * /100 equivalent. maxPossible is 100 for kickoff and for a coaching call
 * with D4 active, so this is arithmetically a no-op there; it does real work
 * for a coaching call with D4 disabled, per the rubric's own "report the
 * result on the 100 scale" instruction.
 *
 * Rounded to 1 decimal place HERE, the one place this division happens -
 * without it, a D4-disabled call's /90-derived percentage is a repeating
 * decimal (77/90*100 = 85.55555555555556) that both the web report and the
 * PDF interpolate raw with no formatting of their own, so it would otherwise
 * render exactly that ugly, straight to the coach reading the report. Every
 * other caller (report.total, oneThing's currentTotal/potentialTotal - see
 * oneThing.ts, which computes both via this same function) inherits the fix
 * for free rather than needing its own rounding.
 */
export function rescaleToHundred(rawTotal: number, maxPossible: number): number {
  if (maxPossible <= 0) return 0;
  return Math.round((rawTotal / maxPossible) * 1000) / 10;
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
