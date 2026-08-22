/**
 * Every read/write against the `runs` table goes through here - API routes
 * and the run page both call these instead of touching supabaseAdmin
 * directly, so the DB row shape (snake_case, matching db/schema.sql) only
 * gets translated to/from the app's camelCase shape in one place.
 */

import { supabaseAdmin } from "./supabase";
import type { CallType } from "@/types/rubric";
import type { Report } from "@/types/report";
import type { PipelineStage } from "@/pipeline/runPipeline";

export type RunStatus = "pending" | "running" | "complete" | "failed";

export interface RunRecord {
  id: string;
  callType: CallType;
  transcriptHash: string;
  status: RunStatus;
  /** Which of the 3 LLM calls is in flight - only meaningful while status is 'running'. */
  stage: PipelineStage | null;
  error: string | null;
  model: string | null;
  report: Report | null;
  createdAt: string;
  updatedAt: string;
}

interface RunRow {
  id: string;
  call_type: CallType;
  transcript_hash: string;
  status: RunStatus;
  stage: PipelineStage | null;
  error: string | null;
  model: string | null;
  report: Report | null;
  created_at: string;
  updated_at: string;
}

const RUN_COLUMNS = "id, call_type, transcript_hash, status, stage, error, model, report, created_at, updated_at";

function mapRow(row: RunRow): RunRecord {
  return {
    id: row.id,
    callType: row.call_type,
    transcriptHash: row.transcript_hash,
    status: row.status,
    stage: row.stage,
    error: row.error,
    model: row.model,
    report: row.report,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Dedup check for the create-run flow (the deferred half of the Phase-5-era
 * hashing decision - see README's "Ahead of Phase 6" note). Deliberately
 * matches 'pending'/'running'/'complete', not just 'complete' - the most
 * likely real double-submit is re-pasting the same transcript while the
 * first run is still in flight, not after it's finished. A prior 'failed'
 * run does NOT match, so a genuine retry after a failure always gets a
 * fresh run rather than being stuck pointing at the failure.
 */
export async function findActiveOrCompleteRunByHash(callType: CallType, transcriptHash: string): Promise<RunRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("runs")
    .select(RUN_COLUMNS)
    .eq("call_type", callType)
    .eq("transcript_hash", transcriptHash)
    .in("status", ["pending", "running", "complete"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`findActiveOrCompleteRunByHash failed: ${error.message}`);
  return data ? mapRow(data as RunRow) : null;
}

export async function createRun(callType: CallType, transcript: string, transcriptHash: string): Promise<RunRecord> {
  const { data, error } = await supabaseAdmin
    .from("runs")
    .insert({ call_type: callType, transcript, transcript_hash: transcriptHash })
    .select(RUN_COLUMNS)
    .single();

  if (error) throw new Error(`createRun failed: ${error.message}`);
  return mapRow(data as RunRow);
}

export async function markRunStage(id: string, stage: PipelineStage): Promise<void> {
  const { error } = await supabaseAdmin.from("runs").update({ status: "running", stage }).eq("id", id);
  if (error) throw new Error(`markRunStage failed: ${error.message}`);
}

export async function completeRun(id: string, report: Report, model: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("runs")
    .update({ status: "complete", stage: null, report, model, error: null })
    .eq("id", id);
  if (error) throw new Error(`completeRun failed: ${error.message}`);
}

export async function failRun(id: string, errorMessage: string): Promise<void> {
  const { error } = await supabaseAdmin.from("runs").update({ status: "failed", stage: null, error: errorMessage }).eq("id", id);
  if (error) throw new Error(`failRun failed: ${error.message}`);
}

export async function getRun(id: string): Promise<RunRecord | null> {
  const { data, error } = await supabaseAdmin.from("runs").select(RUN_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`getRun failed: ${error.message}`);
  return data ? mapRow(data as RunRow) : null;
}
