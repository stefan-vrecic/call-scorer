/**
 * Stage 1 / Stage 2 contracts.
 *
 * Stage 1 answers "what actually happened in the call?" - evidence only, no
 * judgment, no score field. Stage 2 answers "given those facts and the rubric,
 * how many points does this deserve?" - takes VALIDATED Stage 1 evidence as
 * input, never the raw transcript again.
 *
 * These are Zod schemas (not just TS types) because they're the shape passed
 * to the Anthropic SDK's structured-output call (client.messages.parse +
 * zodOutputFormat) in Phase 2 / Phase 4 - the schema IS the API contract, not
 * just documentation of it.
 */

import { z } from "zod";

/** One piece of evidence: a transcript line number + the exact quote at that line. */
export const EvidenceSchema = z.object({
  line: z.number().int().positive(),
  quote: z.string().min(1),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

/**
 * Stage 1 output for a single dimension. Deliberately has NO score field -
 * Stage 1 is not allowed to judge, only to observe and cite.
 */
export const DimensionEvidenceSchema = z.object({
  dimensionId: z.string(),
  /** Did this dimension's behaviour show up in the call at all? */
  observed: z.boolean(),
  /** Plain-language description of what was observed (or wasn't) - not a score, not a verdict. */
  observedBehaviour: z.string(),
  evidence: z.array(EvidenceSchema),
  /**
   * True when the transcript doesn't contain enough to judge this dimension.
   * This is the model's explicit "I don't know" - it must be allowed to say
   * this instead of inventing evidence. When true, `evidence` may be empty.
   */
  insufficientEvidence: z.boolean(),
});
export type DimensionEvidence = z.infer<typeof DimensionEvidenceSchema>;

/**
 * Call-level facts Stage 1 must also report, because the rubrics' automatic
 * caps are conditions about the WHOLE call, not any one dimension (e.g. "coach
 * speaks >70% of the time"). Extracting them here keeps them evidence-based
 * facts from Stage 1, while the cap itself firing is still 100% code
 * (see scoring/kickoffCaps.ts, scoring/coachingCaps.ts) - the model reports
 * the fact, the code applies the rule.
 *
 * Not every field applies to every call type; the unused ones for a given
 * call type are simply ignored by that rubric's cap functions.
 */
export const CallLevelSignalsSchema = z.object({
  // --- kickoff signals ---
  noFollowUpQuestionsAnywhere: z.boolean().optional(),
  coachDominatesWithoutEngagement: z.boolean().optional(),
  clientUnresolvedConfusion: z.boolean().optional(),
  noNorthStarStatement: z.boolean().optional(),

  // --- coaching signals ---
  nextCallBookedLive: z.boolean().optional(),
  longTermVisionConnected: z.boolean().optional(),
  coachSpeaksOver75PctPassiveClient: z.boolean().optional(),
  concreteAccountabilityCommitmentPresent: z.boolean().optional(),
  struggleIgnoredOrAvoided: z.boolean().optional(),
  noActionStepsEitherParty: z.boolean().optional(),
  /** Coaching D4 only - true when the call had no live movement coaching at all. */
  movementCoachingDisabled: z.boolean().optional(),
  movementCoachingDisabledReason: z.string().optional(),
});
export type CallLevelSignals = z.infer<typeof CallLevelSignalsSchema>;

export const Stage1OutputSchema = z.object({
  dimensions: z.array(DimensionEvidenceSchema),
  signals: CallLevelSignalsSchema,
});
export type Stage1Output = z.infer<typeof Stage1OutputSchema>;

/**
 * Stage 2 output for a single dimension - judgment only, working from
 * validated Stage 1 evidence. No evidence field here: evidence already lives
 * on the Stage 1 record for this dimension, Stage 2 just attaches a score to it.
 */
export const DimensionScoreSchema = z.object({
  dimensionId: z.string(),
  score: z.number(),
  reasoning: z.string(),
  /** What the coach would have needed to do to reach full marks on this dimension. */
  quickFix: z.string(),
});
export type DimensionScore = z.infer<typeof DimensionScoreSchema>;

export const Stage2OutputSchema = z.object({
  dimensions: z.array(DimensionScoreSchema),
});
export type Stage2Output = z.infer<typeof Stage2OutputSchema>;

/**
 * Synthesis call output (Phase 5) - built from Stage 2's already-validated,
 * already-scored structured output, not the raw transcript and not a fresh
 * read of the evidence. This call is strictly downstream of the deterministic
 * logic: it doesn't choose, score, cap, or reinterpret anything - it only
 * writes prose describing results that are already final by the time it runs.
 */
export const SynthesisOutputSchema = z.object({
  brief: z.string(),
  redFlags: z.array(z.string()),
  /**
   * Explains the already-selected oneThing candidate (see scoring/oneThing.ts) -
   * optional because oneThing can legitimately be null (every scored dimension
   * already at max), in which case there's nothing to explain and this field
   * is omitted from the tool call entirely (see synthesis.ts's dynamic schema).
   */
  oneThingExplanation: z.string().optional(),
});
export type SynthesisOutput = z.infer<typeof SynthesisOutputSchema>;
