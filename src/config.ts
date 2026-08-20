/**
 * One place the model choice and per-call token budgets live. Every pipeline
 * call reads from here rather than hardcoding a model string - changing the
 * model later (including per-call, e.g. bumping just the synthesis call to
 * Opus) is a one-line edit here, not a hunt through the codebase.
 */

export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

/** Evidence JSON for 12 dimensions + call-level signals - generous headroom, not expected to get close. */
export const STAGE1_MAX_TOKENS = 8000;
