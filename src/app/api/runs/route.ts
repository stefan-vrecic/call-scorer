/**
 * POST /api/runs - creates a run and responds immediately with its id; the
 * actual scoring pipeline (60-105s observed) runs AFTER the response is
 * sent, via Next's after() - this is what makes "I can close the tab, the
 * evaluation keeps running" true. maxDuration is set to a value safe on
 * every Vercel plan; see config.ts's RUN_STALE_MS for the backstop if a
 * plan's real cap ever kills this mid-run anyway.
 */

import { NextResponse, after } from "next/server";
import { hashTranscript } from "@/lib/transcriptHash";
import { createRun, findActiveOrCompleteRunByHash, markRunStage, completeRun, failRun } from "@/lib/runs";
import { runScoringPipeline, type PipelineStage } from "@/pipeline/runPipeline";
import { MODEL } from "@/config";
import type { CallType } from "@/types/rubric";

export const maxDuration = 60;

const MIN_TRANSCRIPT_LENGTH = 20;

function isCallType(value: unknown): value is CallType {
  return value === "kickoff" || value === "coaching";
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
      await failRun(run.id, message);
    }
  });

  return NextResponse.json({ id: run.id, deduped: false }, { status: 202 });
}
