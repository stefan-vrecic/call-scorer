/**
 * POST /api/runs - creates a run and responds immediately with its id; the
 * actual scoring pipeline (60-105s observed LOCALLY, without a retry) runs
 * AFTER the response is sent, via Next's after() - this is what makes "I can
 * close the tab, the evaluation keeps running" true.
 *
 * Phase 10 finding: maxDuration was originally 60, reasoned as "safe on
 * every Vercel plan" - live-tested against the real production deployment,
 * NOT a safe assumption. A real run needed one synthesis retry (the known
 * Phase 5 redFlags-malformation case - expected occasionally, not itself a
 * bug) and Vercel killed it at exactly 60s: "Vercel Runtime Timeout Error:
 * Task timed out after 60 seconds", confirmed via `vercel logs`. 60s covers
 * the no-retry case with barely any margin and has none at all for even one
 * retry on any of the 3 LLM calls - raised to 180s, which comfortably covers
 * the worst locally-observed no-retry pipeline (105s) plus room for a retry,
 * while staying well under RUN_STALE_MS (5 min, config.ts) so the staleness
 * backstop still has real headroom beyond legitimate max duration, not just
 * a hair's difference from it.
 */

import { NextResponse, after } from "next/server";
import { hashTranscript } from "@/lib/transcriptHash";
import { createRun, findActiveOrCompleteRunByHash, markRunStage, completeRun, failRun } from "@/lib/runs";
import { runScoringPipeline, type PipelineStage } from "@/pipeline/runPipeline";
import { MODEL, MAX_TRANSCRIPT_LENGTH, MIN_TRANSCRIPT_LINES } from "@/config";
import type { CallType } from "@/types/rubric";

export const maxDuration = 180;

const MIN_TRANSCRIPT_LENGTH = 20;

function isCallType(value: unknown): value is CallType {
  return value === "kickoff" || value === "coaching";
}

/** Count of non-blank lines - matches indexTranscript()'s own definition of a "turn" (Phase 2), so this check fails on exactly the input shape that would silently break evidence citation, not on blank-line formatting choices. */
function nonBlankLineCount(transcript: string): number {
  return transcript.split("\n").filter((line) => line.trim().length > 0).length;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const { callType, transcript } = (body ?? {}) as { callType?: unknown; transcript?: unknown };

  if (!isCallType(callType)) {
    return NextResponse.json({ error: "callType must be 'kickoff' or 'coaching'." }, { status: 400 });
  }
  if (typeof transcript !== "string" || transcript.trim().length < MIN_TRANSCRIPT_LENGTH) {
    return NextResponse.json({ error: `transcript must be a string of at least ${MIN_TRANSCRIPT_LENGTH} characters.` }, { status: 400 });
  }
  // Cost guardrail (Phase 9) - reject BEFORE hashing/storing/spending any API
  // cost on something that clearly isn't a single call transcript.
  if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
    return NextResponse.json(
      { error: `transcript is too long (${transcript.length} characters, max ${MAX_TRANSCRIPT_LENGTH}) - this doesn't look like a single call transcript.` },
      { status: 400 },
    );
  }
  // Quality guardrail (Phase 9) - too few line breaks silently breaks the
  // evidence-citation mechanism (every quote collapses to ~line 1) rather
  // than erroring, so catch it here instead of producing a degraded report.
  const lineCount = nonBlankLineCount(transcript);
  if (lineCount < MIN_TRANSCRIPT_LINES) {
    return NextResponse.json(
      { error: `transcript only has ${lineCount} line(s) of content - a real call transcript should have many speaker turns, each on its own line.` },
      { status: 400 },
    );
  }

  const transcriptHash = hashTranscript(callType, transcript);

  const existing = await findActiveOrCompleteRunByHash(callType, transcriptHash);
  if (existing) {
    return NextResponse.json({ id: existing.id, deduped: true }, { status: 200 });
  }

  const run = await createRun(callType, transcript, transcriptHash);

  after(async () => {
    try {
      const report = await runScoringPipeline(callType, transcript, {
        onStageChange: (stage: PipelineStage) => markRunStage(run.id, stage),
      });
      await completeRun(run.id, report, MODEL);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error - the pipeline threw a non-Error value.";
      // Phase 9 hardening: failRun() itself is a network call to Supabase and
      // can fail too (the same outage that could plausibly have contributed
      // to the pipeline failing in the first place). Without this try/catch,
      // that becomes an unhandled rejection inside after() - the run row is
      // left exactly where it was (status 'pending'/'running', never
      // 'failed'), with NOTHING recorded anywhere about why. Can't fix "the
      // failure record itself failed to write," but console.error at least
      // puts the run id and both error messages in the server/Vercel logs,
      // so it's discoverable there instead of silently lost - and the
      // stalled-run backstop below (GET /api/runs/[id]) still catches the
      // stuck row even though it was never marked 'failed'.
      try {
        await failRun(run.id, message);
      } catch (failErr) {
        const failMessage = failErr instanceof Error ? failErr.message : "Unknown error";
        console.error(
          `Run ${run.id}: pipeline failed (${message}) AND failRun() itself failed (${failMessage}) - this run's status was NOT updated and will only be caught by the stalled-run check.`,
        );
      }
    }
  });

  return NextResponse.json({ id: run.id, deduped: false }, { status: 202 });
}
