/**
 * Builds the Stage 1 (evidence extraction) system prompt FROM the rubric
 * contract's data - never hand-written prose, never re-reads the source .md
 * files. Deliberately omits each dimension's bands/criteria/point values:
 * Stage 1's only job is "what happened, cite the lines," and showing it the
 * scoring scale risks anchoring its observations toward a score before
 * Stage 2 (a completely separate call, working only from Stage 1's already-
 * validated evidence) ever gets a turn to judge.
 */

import type { RubricContract } from "@/types/rubric";

function formatDimension(dimension: RubricContract["dimensions"][number]): string {
  const lines = [
    `### ${dimension.id} - ${dimension.name}`,
    `What to look for: ${dimension.whatToLookFor}`,
  ];
  if (dimension.positiveSignals.length > 0) {
    lines.push(`Positive signals (not exhaustive - other evidence counts too): ${dimension.positiveSignals.join(" | ")}`);
  }
  if (dimension.negativeSignals.length > 0) {
    lines.push(`Negative signals: ${dimension.negativeSignals.join(" | ")}`);
  }
  return lines.join("\n");
}

function formatSignals(rubric: RubricContract): string {
  const lines = rubric.automaticCaps.map(
    (cap) => `- ${cap.signal}: true when the following is the case - "${cap.condition}". Otherwise false.`,
  );

  const optionalDimension = rubric.dimensions.find((d) => d.optional && d.disableDetectionCriteria);
  if (optionalDimension) {
    lines.push(
      `- movementCoachingDisabled: true ONLY if ALL of the following are absent from the call (report false if even one is present):`,
      ...optionalDimension.disableDetectionCriteria!.map((c) => `    - ${c}`),
      `- movementCoachingDisabledReason: if movementCoachingDisabled is true, a short plain-language reason (e.g. "no movement coaching on this call - session was entirely strategy/accountability"). Omit or leave empty if false.`,
    );
  }

  return lines.join("\n");
}

export function buildStage1SystemPrompt(rubric: RubricContract): string {
  const dimensionsText = rubric.dimensions.map(formatDimension).join("\n\n");
  const signalsText = formatSignals(rubric);

  return `You are the evidence-extraction stage of a call-scoring pipeline for a fitness coaching company. This is Stage 1 of 2. Your ONLY job is to observe and cite what happened in the call - you are NOT judging quality and you must NOT include any score, rating, grade, or quality verdict anywhere in your output. A separate Stage 2 process, working only from what you report here, decides the scoring.

The transcript has been split into numbered lines, one per speaking turn, formatted as "[NNN] [Speaker]: what they said". This is a ${rubric.callType} call.

EVIDENCE RULES - read carefully, these are the most important instructions in this prompt:
- Every piece of evidence you cite MUST give the EXACT line number it came from and an EXACT, verbatim, CONTINUOUS substring of that line's own text (not the [NNN] prefix, not the speaker tag - just the spoken words). Do not paraphrase a quote. Do not combine text from two different lines into one quote. Do not invent a line number.
- A quote must be a single unbroken excerpt - never join two separate parts of the same line with "..." or any other ellipsis/joiner, even if both parts are real and from that exact line. A line's speaker often says several separate things worth citing - if two different parts of one line are both worth citing, report them as two separate {line, quote} entries in the evidence array (same line number, two entries), not one quote that skips the middle.
- If the transcript does not contain enough to judge a dimension, set insufficientEvidence to true for that dimension and leave evidence sparse or empty. Never invent evidence to avoid an empty result. A dimension with no real evidence in the transcript should look like an honest "not enough here" - not a fabricated observation.
- observedBehaviour is a plain description of what happened (or didn't) - not a score, not a verdict, not band language like "Elite" or "Strong".
- Self-consistency: before finalizing, check every call-level signal below against the dimension evidence you just wrote. Where a signal's condition describes the same real-world fact a specific dimension's evidence also speaks to (e.g. a booking-related signal and a booking-related dimension), the two must agree. Do not report a signal that contradicts your own per-dimension observedBehaviour/evidence for the same fact.

For every one of the ${rubric.dimensions.length} dimensions below, report: dimensionId, observed (boolean), observedBehaviour, evidence ({line, quote}[]), insufficientEvidence (boolean).

DIMENSIONS:

${dimensionsText}

CALL-LEVEL SIGNALS:
Also report these as a single "signals" object, each a plain true/false based on what actually happened in the call:

${signalsText}`;
}
