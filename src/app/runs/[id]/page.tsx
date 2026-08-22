"use client";

/**
 * Phase 6: proves the persistence + async + progress flow works end to end.
 * Deliberately minimal rendering of a complete report (total/band/brief/red
 * flags + a raw JSON dump) - the polished 12-dimension report view is
 * Phase 7's job, not this one. Polls GET /api/runs/[id] every 2s while
 * pending/running so the client stays updated without the operator having
 * to reload, and stops polling the moment there's a terminal state
 * (complete/failed/stalled) so it doesn't poll forever.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const POLL_INTERVAL_MS = 2000;

const STAGE_LABELS: Record<string, string> = {
  extracting_evidence: "Extracting evidence from the transcript",
  scoring: "Scoring against the rubric",
  summarizing: "Writing the summary",
};
const STAGE_ORDER = ["extracting_evidence", "scoring", "summarizing"];

interface RunResponse {
  id: string;
  callType: "kickoff" | "coaching";
  status: "pending" | "running" | "complete" | "failed";
  stage: string | null;
  error: string | null;
  model: string | null;
  report: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  stalled: boolean;
}

export default function RunPage() {
  const params = useParams<{ id: string }>();
  const [run, setRun] = useState<RunResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const res = await fetch(`/api/runs/${params.id}`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setFetchError(data.error ?? "Could not load this run.");
          return;
        }
        setFetchError(null);
        setRun(data as RunResponse);

        const done = data.status === "complete" || data.status === "failed" || data.stalled;
        if (!done) timer = setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (!cancelled) {
          setFetchError("Lost connection while checking this run's status. Retrying...");
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [params.id]);

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "3rem 1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <p><a href="/">&larr; Score another call</a></p>
      <h1>Run {params.id}</h1>

      {fetchError && <p style={{ color: "#c0392b" }}>{fetchError}</p>}
      {!run && !fetchError && <p>Loading...</p>}

      {run && <RunStatus run={run} />}
    </main>
  );
}

function RunStatus({ run }: { run: RunResponse }) {
  if (run.status === "failed") {
    return (
      <div style={{ border: "1px solid #c0392b", borderRadius: 6, padding: "1rem", background: "#fdecea" }}>
        <strong>This run failed.</strong>
        <p style={{ marginBottom: 0 }}>{run.error ?? "No error message was recorded."}</p>
      </div>
    );
  }

  if (run.stalled) {
    return (
      <div style={{ border: "1px solid #d68910", borderRadius: 6, padding: "1rem", background: "#fef5e7" }}>
        <strong>This run appears to have stalled.</strong>
        <p>
          It&apos;s been on &ldquo;{STAGE_LABELS[run.stage ?? ""] ?? run.stage}&rdquo; for longer than expected and hasn&apos;t updated -
          most likely the background job was interrupted before it could finish or report an error. Try submitting the transcript again.
        </p>
      </div>
    );
  }

  if (run.status === "pending" || run.status === "running") {
    return <Progress stage={run.status === "pending" ? null : run.stage} />;
  }

  // complete
  const report = run.report as {
    total?: number;
    maxPossible?: number;
    band?: string;
    brief?: string;
    redFlags?: string[];
  } | null;

  return (
    <div>
      <div style={{ border: "1px solid #27ae60", borderRadius: 6, padding: "1rem", background: "#eafaf1", marginBottom: "1.5rem" }}>
        <strong>Score: {report?.total} / {report?.maxPossible} &mdash; {report?.band}</strong>
        {report?.brief && <p>{report.brief}</p>}
        {report?.redFlags && report.redFlags.length > 0 && (
          <>
            <strong>Red flags</strong>
            <ul>
              {report.redFlags.map((flag, i) => (
                <li key={i}>{flag}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      <details>
        <summary>Full report (raw JSON - the real report view is coming in the next phase)</summary>
        <pre style={{ overflowX: "auto", background: "#f5f5f5", padding: "1rem", fontSize: "0.8rem" }}>
          {JSON.stringify(run.report, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function Progress({ stage }: { stage: string | null }) {
  const currentIndex = stage ? STAGE_ORDER.indexOf(stage) : -1;

  return (
    <div>
      <p>{stage ? "Scoring in progress..." : "Queued - about to start..."}</p>
      <ol style={{ listStyle: "none", padding: 0 }}>
        {STAGE_ORDER.map((s, i) => {
          const status = i < currentIndex ? "done" : i === currentIndex ? "active" : "pending";
          return (
            <li key={s} style={{ padding: "0.4rem 0", opacity: status === "pending" ? 0.5 : 1 }}>
              {status === "done" ? "✅" : status === "active" ? "⏳" : "⚪️"} {STAGE_LABELS[s]}
            </li>
          );
        })}
      </ol>
      <p style={{ fontSize: "0.85rem", color: "#666" }}>This page updates on its own - you can also close the tab and come back to this same link later.</p>
    </div>
  );
}
