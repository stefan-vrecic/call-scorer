/**
 * One place the model choice and per-call token budgets live. Every pipeline
 * call reads from here rather than hardcoding a model string - changing the
 * model later (including per-call, e.g. bumping just the synthesis call to
 * Opus) is a one-line edit here, not a hunt through the codebase.
 */

export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

/** Evidence JSON for 12 dimensions + call-level signals - generous headroom, not expected to get close. */
export const STAGE1_MAX_TOKENS = 8000;

/** Scores + reasoning + quickFix for up to 12 dimensions - flatter than Stage 1's output, smaller budget is plenty. */
export const STAGE2_MAX_TOKENS = 6000;

/**
 * Evidence-validation thresholds (Phase 3). PROVISIONAL - reasoned defaults,
 * not yet calibrated against a large sample of real invalid-citation data.
 * Asymmetric on purpose: warn is cheap (doesn't stop anything) so it can
 * trigger sensitively; fail is expensive (kills the run) so it requires a
 * higher, harder-to-hit bar - both a rate AND an absolute-count floor, so a
 * couple of citations on a thin-evidence call can't fail a run on noise.
 */
export const EVIDENCE_WARN_RATE = 0.08;
export const EVIDENCE_WARN_MIN_COUNT = 3;
export const EVIDENCE_FAIL_RATE = 0.2;
export const EVIDENCE_FAIL_MIN_COUNT = 5;
