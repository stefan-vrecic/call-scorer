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

/** A short brief + a handful of red-flag strings + one explanation sentence - the smallest output of the three calls. */
export const SYNTHESIS_MAX_TOKENS = 2000;

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

/**
 * Real observed pipeline durations this session ranged 57-105s. Vercel's
 * serverless max-duration cap (plan-dependent) means the background `after()`
 * work COULD get killed mid-run - if that happens, the row is stuck on
 * status='running' with no further update. Rather than requiring a specific
 * plan/duration guarantee, a run's page treats 'running' with no update in
 * this long as stalled and tells the reviewer plainly, instead of spinning
 * forever - see src/lib/runs.ts's `stalled` computation.
 */
export const RUN_STALE_MS = 5 * 60 * 1000;

/**
 * Phase 9 hardening: input guardrails on POST /api/runs, enforced BEFORE the
 * transcript is hashed/stored/sent to any API - the whole point is to reject
 * an out-of-scope paste before it costs anything, not after.
 *
 * MAX_TRANSCRIPT_LENGTH is a cost guardrail, not a content judgment: nothing
 * currently stops someone pasting something far outside "one call transcript"
 * (a log file, a whole document, an accidental multi-paste) and paying real
 * Stage 1/2 input-token cost for it. All 4 real reference transcripts are
 * 15,000-65,000 characters; 150,000 is ~2.3x the largest real one - generous
 * headroom for a genuinely long call, while still catching something that's
 * clearly not a single call transcript.
 *
 * MIN_TRANSCRIPT_LINES is a quality guardrail, not a length one: a transcript
 * with too few line breaks isn't caught by MIN_TRANSCRIPT_LENGTH (a long
 * single line passes it easily) but breaks the evidence-citation mechanism
 * itself - indexTranscript() (Phase 2) treats every non-blank line as one
 * turn, so a near-single-line paste collapses most/all citations to the same
 * line number, silently degrading every dimension's evidence instead of
 * erroring. Real transcripts run into the hundreds of lines; 5 is a low,
 * deliberately permissive floor - just enough to catch "this obviously isn't
 * a real multi-turn transcript," not to police formatting.
 */
export const MAX_TRANSCRIPT_LENGTH = 150_000;
export const MIN_TRANSCRIPT_LINES = 5;
