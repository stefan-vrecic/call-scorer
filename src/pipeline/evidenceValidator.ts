/**
 * Phase 3: validates Stage 1's evidence citations against the actual
 * transcript before Stage 2 ever sees them. This is the mechanism that makes
 * "evidence or nothing" real rather than a prompt-only promise - see the
 * exact failure-mode spec worked out before this was built (three cases:
 * quote doesn't match the cited line, cited line doesn't exist, quote is
 * real text but at a different line). All three FAIL the citation. None of
 * them get silently corrected or relocated - a citation that's wrong about
 * WHERE something was said is still a broken citation, even if the words
 * are real.
 */

import type { Evidence, CallLevelSignals, Stage1Output } from "@/types/evaluation";
import type { IndexedTranscript } from "@/lib/transcript";
import { getLine } from "@/lib/transcript";
import { EVIDENCE_WARN_RATE, EVIDENCE_WARN_MIN_COUNT, EVIDENCE_FAIL_RATE, EVIDENCE_FAIL_MIN_COUNT } from "@/config";

export type EvidenceInvalidReason = "line-out-of-range" | "quote-not-found-on-line";

export interface EvidenceValidationResult {
  line: number;
  quote: string;
  valid: boolean;
  reason?: EvidenceInvalidReason;
  /**
   * Diagnostic only - NEVER affects `valid`. Other line numbers where this
   * exact (normalized) quote actually appears, if any. Exists so a pattern
   * (e.g. consistently off-by-one) is visible in logs, not to rescue the citation.
   */
  foundAtLines?: number[];
}

export interface DimensionValidationResult {
  dimensionId: string;
  /** Passed through from Stage 1 - Stage 2 wants this alongside the validated evidence, and they're already zipped together here. */
  observedBehaviour: string;
  results: EvidenceValidationResult[];
  /** Only the evidence items that passed - this is what Stage 2 is allowed to see. */
  validEvidence: Evidence[];
  /** Stage 1's own claim, OR forced true if every evidence item was rejected - see allEvidenceRejected. */
  insufficientEvidence: boolean;
  /** True specifically when Stage 1 claimed real evidence but validation found none of it trustworthy - distinct from Stage 1 honestly saying "insufficient" up front. */
  allEvidenceRejected: boolean;
}

export interface Stage1ValidationSummary {
  totalEvidence: number;
  invalidEvidence: number;
  /** 0 when totalEvidence is 0 (nothing to divide by, not a failure by itself). */
  invalidRate: number;
  /** invalidRate >= EVIDENCE_WARN_RATE OR invalidEvidence >= EVIDENCE_WARN_MIN_COUNT. Doesn't stop anything. */
  warning: boolean;
  /** invalidRate >= EVIDENCE_FAIL_RATE AND invalidEvidence >= EVIDENCE_FAIL_MIN_COUNT. Both required - see config.ts for why. */
  fail: boolean;
}

export interface Stage1ValidationResult {
  dimensions: DimensionValidationResult[];
  /** Passed through unchanged - call-level signals have no per-citation evidence to validate (known gap, documented separately). */
  signals: CallLevelSignals;
  summary: Stage1ValidationSummary;
}

/** Whitespace and smart-quote normalization only - never fuzzy, never partial-word, never edit-distance tolerant. */
function normalize(text: string): string {
  return text
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function findQuoteLines(quote: string, transcript: IndexedTranscript): number[] {
  const target = normalize(quote);
  const matches: number[] = [];
  transcript.lines.forEach((line, i) => {
    if (normalize(line).includes(target)) matches.push(i + 1);
  });
  return matches;
}

export function validateEvidenceItem(evidence: Evidence, transcript: IndexedTranscript): EvidenceValidationResult {
  const lineText = getLine(transcript, evidence.line);

  if (lineText === undefined) {
    return { line: evidence.line, quote: evidence.quote, valid: false, reason: "line-out-of-range" };
  }

  const onCitedLine = normalize(lineText).includes(normalize(evidence.quote));
  if (onCitedLine) {
    return { line: evidence.line, quote: evidence.quote, valid: true };
  }

  // Wrong line - real text elsewhere is still a broken citation (see file header).
  // Search everywhere EXCEPT the cited line, purely for diagnostics.
  const foundAtLines = findQuoteLines(evidence.quote, transcript).filter((l) => l !== evidence.line);

  return {
    line: evidence.line,
    quote: evidence.quote,
    valid: false,
    reason: "quote-not-found-on-line",
    ...(foundAtLines.length > 0 ? { foundAtLines } : {}),
  };
}

function validateDimension(
  dimension: Stage1Output["dimensions"][number],
  transcript: IndexedTranscript,
): DimensionValidationResult {
  const results = dimension.evidence.map((e) => validateEvidenceItem(e, transcript));
  const validEvidence = results.filter((r) => r.valid).map((r) => ({ line: r.line, quote: r.quote }));

  const claimedEvidence = dimension.evidence.length > 0;
  const allEvidenceRejected = claimedEvidence && validEvidence.length === 0;

  return {
    dimensionId: dimension.dimensionId,
    observedBehaviour: dimension.observedBehaviour,
    results,
    validEvidence,
    insufficientEvidence: dimension.insufficientEvidence || allEvidenceRejected,
    allEvidenceRejected,
  };
}

export function validateStage1Output(output: Stage1Output, transcript: IndexedTranscript): Stage1ValidationResult {
  const dimensions = output.dimensions.map((d) => validateDimension(d, transcript));

  const allResults = dimensions.flatMap((d) => d.results);
  const totalEvidence = allResults.length;
  const invalidEvidence = allResults.filter((r) => !r.valid).length;
  const invalidRate = totalEvidence > 0 ? invalidEvidence / totalEvidence : 0;

  const warning = invalidRate >= EVIDENCE_WARN_RATE || invalidEvidence >= EVIDENCE_WARN_MIN_COUNT;
  const fail = invalidRate >= EVIDENCE_FAIL_RATE && invalidEvidence >= EVIDENCE_FAIL_MIN_COUNT;

  return {
    dimensions,
    signals: output.signals,
    summary: { totalEvidence, invalidEvidence, invalidRate, warning, fail },
  };
}
