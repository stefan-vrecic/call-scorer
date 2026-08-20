/**
 * The rubric contract.
 *
 * This is the machine-readable representation of the two human-written rubrics
 * (rubrics/kickoff.ts, rubrics/coaching.ts in exercise-reference are the source
 * of truth in prose; these types + the data files in src/rubrics/ are the
 * structured version the application actually runs on).
 *
 * Kickoff and coaching are NOT structurally identical:
 *  - Kickoff: most dimensions are genuine min–max bands (any value in range is
 *    valid), with half-step precision when a dimension's max is <= 5. A few
 *    kickoff dimensions collapse to fixed single values per level (encoded as
 *    a band where min === max) - see rubrics/kickoff.ts for which.
 *  - Coaching: every dimension is discrete buckets only - no interpolation.
 *    The rubric states this explicitly ("Discrete scoring... No interpolation").
 *    Encoded the same way (bands with min === max), gated by `discreteOnly`
 *    on the contract.
 */

export type CallType = "kickoff" | "coaching";

/** One scoring level within a dimension (e.g. "Elite", "Strong", "Mid"...). */
export interface ScoreBand {
  /** Label as written in the rubric, e.g. "Elite", "Strong", "Mid", "Weak", "Fail". */
  label: string;
  /** Lower bound of this level, inclusive. */
  min: number;
  /** Upper bound of this level, inclusive. min === max for a fixed-value level. */
  max: number;
  /** The rubric's own criteria text for this level. */
  criteria: string;
}

export interface DimensionContract {
  /** "D1".."D12" - matches the rubric's own numbering. */
  id: string;
  name: string;
  maxScore: number;
  /** What Stage 1 should be looking for - feeds the evidence-extraction prompt. */
  whatToLookFor: string;
  bands: ScoreBand[];
  positiveSignals: string[];
  negativeSignals: string[];
  /** Verbatim calibration notes / reviewer-corrected anchors, where the rubric gives them. */
  calibrationNotes?: string[];
  /**
   * Kickoff only. 0.5 when maxScore <= 5 (the rubric's half-step rule), else 1.
   * Irrelevant for coaching (discreteOnly dimensions only ever take one of the
   * band's fixed values).
   */
  stepSize?: 0.5 | 1;
  /**
   * Coaching D4 only (Movement Coaching Quality) - can be switched off entirely
   * when no movement coaching happened on the call. See disableDetection below.
   */
  optional?: boolean;
  /** All of these must be ABSENT from the transcript for the dimension to be disabled. */
  disableDetectionCriteria?: string[];
}

/** What happens when an automatic cap's condition is met. */
export type CapEffect =
  | { type: "maxTotal"; value: number }
  | { type: "maxDimension"; dimensionId: string; value: number }
  | { type: "zeroDimension"; dimensionId: string; nonRecoverable: boolean };

export interface AutomaticCap {
  /** Short slug, e.g. "no-follow-up-questions". */
  id: string;
  /** Human-readable condition, as written in the rubric's cap table. */
  condition: string;
  /**
   * Name of the boolean call-level signal this cap depends on. Stage 1 is
   * asked to report these signals alongside per-dimension evidence;
   * applyRubricRules() reads them from the report and fires the cap
   * deterministically - the model never decides whether a cap fires, only
   * whether the underlying fact is true.
   */
  signal: string;
  /**
   * The cap fires when the signal equals this value. Explicit rather than
   * inferred from the signal's name, so the engine never has to guess
   * polarity from a string (e.g. "nextCallBookedLive" fires the cap at
   * `false`; "struggleIgnoredOrAvoided" fires it at `true`).
   */
  firesWhenSignalIs: boolean;
  effect: CapEffect;
}

export interface ScoreBandDefinition {
  /** Elite / Strong / Inconsistent / At Risk / Fail - exact rubric names. */
  name: string;
  min: number;
  max: number;
}

export interface RubricContract {
  callType: CallType;
  totalPoints: number;
  dimensions: DimensionContract[];
  automaticCaps: AutomaticCap[];
  /** Same five band names/ranges for both rubrics, but each rubric defines its own - never assume they match. */
  scoreBands: ScoreBandDefinition[];
  /** Coaching only: the denominator when D4 is disabled. */
  reducedTotalPoints?: number;
  /** Coaching only: true - no interpolation, a score must equal one band's value exactly. */
  discreteOnly?: boolean;
}
