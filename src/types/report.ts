/**
 * The final report shape.
 *
 * This is what scoring/applyRubricRules.ts produces (merging validated Stage 1
 * evidence + Stage 2 scores + deterministic caps/band/one-thing) and the
 * synthesis call's brief/redFlags get attached to. It's also exactly what gets
 * stored in Supabase's runs.report jsonb column, and what both the web report
 * (Phase 7) and the PDF (Phase 8) render from - one shape, two renderers.
 */

import type { CallType, CapEffect } from "./rubric";
import type { Evidence } from "./evaluation";

/**
 * Records a case where pipeline/signalConsistency.ts overrode a call-level
 * signal because it contradicted its paired dimension's own validated
 * evidence - see that file for why this exists and which pairings are safe.
 * Kept as its own visible Report field (not folded into the narrative brief)
 * for the same reason cappedBy/scoreClampReason are explicit fields: a
 * reviewer opening the run should be able to see exactly what was corrected
 * and why, not just read a sentence about it.
 */
export interface SignalCorrection {
  signal: string;
  dimensionId: string;
  reportedValue: boolean;
  correctedValue: boolean;
  reason: string;
}

export interface AppliedCap {
  id: string;
  /** The rubric's own human-readable condition text, for the report/PDF to display. */
  condition: string;
  effect: CapEffect;
}

export interface ReportDimension {
  id: string;
  name: string;
  /** The dimension's nominal max, before any cap. */
  maxScore: number;
  /** null only when disabled (coaching D4 with no movement coaching on the call). */
  score: number | null;
  reasoning: string;
  quickFix: string;
  evidence: Evidence[];
  observedBehaviour: string;
  insufficientEvidence: boolean;
  disabled: boolean;
  disabledReason?: string;
  /** id of the AutomaticCap that constrained this specific dimension's score, if any. */
  cappedBy?: string;
  /**
   * Set only when Stage 2's raw score didn't fall within any real band for
   * this dimension and had to be clamped (see scoring/scoreValidation.ts) -
   * `score` above is already the clamped value; this records that an
   * adjustment happened and why, the same visibility principle as cappedBy.
   */
  scoreClampReason?: string;
}

export interface OneThing {
  dimensionId: string;
  dimensionName: string;
  currentScore: number;
  /** The dimension's max score, after also lifting any cap it would unlock. */
  potentialScore: number;
  currentTotal: number;
  potentialTotal: number;
  potentialBand: string;
  /** Written by the synthesis call, seeded from this dimension's own quickFix - not a free guess. */
  explanation: string;
}

export interface Report {
  callType: CallType;
  model: string;
  dimensions: ReportDimension[];
  appliedCaps: AppliedCap[];
  /** Sum of dimension scores before any cap clamps the total. */
  rawTotal: number;
  /** After caps applied - this is the number that determines the band. */
  total: number;
  /** 100, or 85 for a coaching call with D4 disabled. */
  maxPossible: number;
  band: string;
  /** null only when every scored dimension is already at its max - nothing left to recommend. */
  oneThing: OneThing | null;
  /** True when Phase 3's evidence validator crossed the warn (not fail) threshold - visible to a reviewer, doesn't block the report. */
  evidenceWarning: boolean;
  /** Empty when Stage 1's signals were internally consistent - see pipeline/signalConsistency.ts. */
  signalCorrections: SignalCorrection[];
  brief: string;
  redFlags: string[];
  generatedAt: string;
}
