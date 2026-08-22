/**
 * GET /api/runs/[id] - polled by the run page every couple seconds while a
 * run is pending/running. Computes `stalled` at read time: true when the row
 * has been sitting on status='running' (or 'pending') with no update for
 * longer than RUN_STALE_MS - the backstop for "a failed run says why" in the
 * cases that aren't a clean throw: the background function itself getting
 * killed by a platform duration cap mid-run, or (Phase 9) the pipeline
 * failing AND the resulting failRun() write also failing (see
 * api/runs/route.ts) - either way leaves a row silently stuck with no error
 * ever written. 'pending' is included, not just 'running': a run that never
 * gets past its first stage-change write is the same "stuck with nothing to
 * tell a reviewer why" situation as one that stalls mid-run.
 */

import { NextResponse } from "next/server";
import { getRun } from "@/lib/runs";
import { RUN_STALE_MS } from "@/config";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getRun(id);

  if (!run) {
    return NextResponse.json({ error: "No run with this id." }, { status: 404 });
  }

  const stalled =
    (run.status === "running" || run.status === "pending") && Date.now() - new Date(run.updatedAt).getTime() > RUN_STALE_MS;

  return NextResponse.json({ ...run, stalled });
}
