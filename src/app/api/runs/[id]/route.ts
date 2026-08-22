/**
 * GET /api/runs/[id] - polled by the run page every couple seconds while a
 * run is pending/running. Computes `stalled` at read time: true when the row
 * has been sitting on status='running' with no update for longer than
 * RUN_STALE_MS - the backstop for "a failed run says why" in the one case
 * that isn't a clean throw (the background function itself getting killed
 * by a platform duration cap mid-run, which would otherwise leave the row
 * silently stuck forever with no error written).
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

  const stalled = run.status === "running" && Date.now() - new Date(run.updatedAt).getTime() > RUN_STALE_MS;

  return NextResponse.json({ ...run, stalled });
}
