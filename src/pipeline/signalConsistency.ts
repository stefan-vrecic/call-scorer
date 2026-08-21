/**
 * Catches a real failure mode found via live-data validation on coaching-02:
 * within a single Stage 1 response, the call-level `signals.nextCallBookedLive`
 * came back false while D10's own evidence/observedBehaviour, cited and
 * validated against the transcript, clearly showed a live booking. Nothing
 * previously cross-checked a bare signal boolean against the dimension it
 * describes, so a downstream cap fired and zeroed D10 based on the
 * self-contradicting, UNEVIDENCED half of Stage 1's own output.
 *
 * The correction rule deliberately trusts the paired dimension's VALIDATED
 * evidence (validEvidence.length > 0 AND Stage 1 itself didn't mark
 * insufficientEvidence) over the signal, never the reverse - the dimension's
 * claim went through Phase 3's citation check against the real transcript;
 * the standalone signal boolean never carries a citation at all, so it has
 * nothing to validate. This is the same "evidence or nothing" principle
 * applied one layer up, not a new one.
 *
 * Only ONE pairing is wired up: coaching's nextCallBookedLive <-> D10. That
 * dimension's own rubric text calls it out as "binary dimension, no partial
 * credit band" - the signal and the dimension are provably describing the
 * exact same fact. Most other signals do NOT have this property - e.g.
 * kickoff's noNorthStarStatement vs D4 is NOT a safe pairing, because D4 is a
 * graded dimension where evidence existing (a goal conversation happened)
 * does not imply a proper North Star was actually built. Don't add a pairing
 * here unless it has the same unambiguous binary correspondence D10 has -
 * a wrong pairing would silently "correct" a signal that was actually right.
 */

import type { CallType } from "@/types/rubric";
import type { CallLevelSignals } from "@/types/evaluation";
import type { SignalCorrection } from "@/types/report";
import type { DimensionValidationResult } from "./evidenceValidator";

type BooleanSignalKey = {
  [K in keyof CallLevelSignals]-?: NonNullable<CallLevelSignals[K]> extends boolean ? K : never;
}[keyof CallLevelSignals];

interface SignalDimensionPair {
  callType: CallType;
  signal: BooleanSignalKey;
  dimensionId: string;
  /** true: signal should be true exactly when the dimension has real, validated evidence. false: the inverse. */
  trueWhenEvidencePresent: boolean;
}

const SIGNAL_DIMENSION_PAIRS: SignalDimensionPair[] = [
  { callType: "coaching", signal: "nextCallBookedLive", dimensionId: "D10", trueWhenEvidencePresent: true },
];

export interface SignalConsistencyResult {
  correctedSignals: CallLevelSignals;
  corrections: SignalCorrection[];
}

function dimensionHasValidatedEvidence(dimension: DimensionValidationResult): boolean {
  return dimension.validEvidence.length > 0 && !dimension.insufficientEvidence;
}

export function checkSignalConsistency(
  callType: CallType,
  signals: CallLevelSignals,
  dimensions: DimensionValidationResult[],
): SignalConsistencyResult {
  const correctedSignals: CallLevelSignals = { ...signals };
  const corrections: SignalCorrection[] = [];

  for (const pair of SIGNAL_DIMENSION_PAIRS) {
    if (pair.callType !== callType) continue;

    const reportedValue = signals[pair.signal];
    if (typeof reportedValue !== "boolean") continue; // not reported for this call - nothing to check

    const dimension = dimensions.find((d) => d.dimensionId === pair.dimensionId);
    if (!dimension) continue;

    const hasEvidence = dimensionHasValidatedEvidence(dimension);
    const expected = pair.trueWhenEvidencePresent ? hasEvidence : !hasEvidence;

    if (reportedValue !== expected) {
      correctedSignals[pair.signal] = expected;
      const sample = dimension.validEvidence[0];
      corrections.push({
        signal: pair.signal,
        dimensionId: pair.dimensionId,
        reportedValue,
        correctedValue: expected,
        reason: sample
          ? `signals.${pair.signal} was reported as ${reportedValue}, but ${pair.dimensionId}'s own evidence - validated against the transcript - supports ${expected}: ${dimension.validEvidence.length} citation(s) survived validation, e.g. "${sample.quote}" (line ${sample.line}). The dimension's validated evidence is trusted over the unevidenced signal.`
          : `signals.${pair.signal} was reported as ${reportedValue}, but ${pair.dimensionId} has no validated evidence supporting that, so it was corrected to ${expected}.`,
      });
    }
  }

  return { correctedSignals, corrections };
}
