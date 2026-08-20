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
  oneThing: OneThing;
  brief: string;
  redFlags: string[];
  generatedAt: string;
}
