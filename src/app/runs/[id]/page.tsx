"use client";

/**
 * Polls GET /api/runs/[id] every 2s while pending/running so the client
 * stays updated without the operator having to reload, and stops polling
 * the moment there's a terminal state (complete/failed/stalled) so it
 * doesn't poll forever. The complete state renders the full report via
 * ReportView (Phase 7) - Phase 6's raw-JSON dump is now tucked behind a
 * "view raw data" toggle for debugging, not the primary view.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReportView, { type ReportShape } from "./ReportView";

const COPIED_FEEDBACK_MS = 1800;

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
      <p><Link href="/">&larr; Score another call</Link></p>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Run {params.id}</h1>
        <CopyLinkButton />
      </div>

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
    // run.stage is null both before the pipeline's first stage-change write
    // and whenever it never got that far (e.g. a Phase 9 double-failure -
    // see api/runs/route.ts) - "hasn't started" reads correctly in both
    // cases, rather than rendering an empty pair of quotes.
    const stageDescription = run.stage ? (STAGE_LABELS[run.stage] ?? run.stage) : "hasn't started";
    return (
      <div style={{ border: "1px solid #d68910", borderRadius: 6, padding: "1rem", background: "#fef5e7" }}>
        <strong>This run appears to have stalled.</strong>
        <p>
          It&apos;s been stuck ({stageDescription}) for longer than expected and hasn&apos;t updated - most likely the background job
          was interrupted before it could finish or report an error. Try submitting the transcript again.
        </p>
      </div>
    );
  }

  if (run.status === "pending" || run.status === "running") {
    return <Progress stage={run.status === "pending" ? null : run.stage} />;
  }

  // complete
  if (!run.report) {
    return <p>This run completed but no report was recorded - that shouldn&apos;t happen. Please re-submit the transcript.</p>;
  }

  return (
    <div>
      <div style={{ marginBottom: "1.5rem" }}>
        <PdfDownloadButton runId={run.id} />
      </div>

      <ReportView report={run.report as unknown as ReportShape} />

      <details style={{ marginTop: "2rem" }}>
        <summary>View raw data</summary>
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

/** Copies this run's own URL - the actual "shareable link" the exercise asks for, not just implied by the URL bar. */
function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      // Clipboard permission denied/unavailable (e.g. an embedding context
      // without the clipboard-write permission policy, an old browser) -
      // fail quietly rather than throw; the URL is still right there in the
      // address bar as a fallback. Confirmed this is a real, reachable path
      // (not just theoretical) while verifying this button - the Claude Code
      // preview browser pane denies clipboard-write entirely, real click or
      // not, which is exactly the class of environment this catch exists for.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      style={{
        fontSize: "0.85rem",
        padding: "0.3rem 0.7rem",
        borderRadius: 6,
        border: "1px solid #ccc",
        background: copied ? "#eafaf1" : "#fff",
        borderColor: copied ? "#a8e0c2" : "#ccc",
        color: copied ? "#1e7e46" : "#333",
        cursor: "pointer",
      }}
    >
      {copied ? "✅ Copied!" : "🔗 Copy link"}
    </button>
  );
}

/**
 * A large, thumb-friendly download button - deliberately much bigger than a
 * plain text link, since "download the PDF" is one of this page's two
 * primary actions (the other being reading the report itself), not a minor
 * footnote. Still a real <a href> (not a JS click handler), so the browser's
 * native download behavior - filename, progress, save location - all work
 * exactly as it would for any other file link.
 */
function PdfDownloadButton({ runId }: { runId: string }) {
  return (
    <a
      href={`/api/runs/${runId}/pdf`}
      title="Download PDF"
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.4rem",
        padding: "0.9rem 1.4rem",
        borderRadius: 12,
        border: "1px solid #e0c9c5",
        background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        width: "fit-content",
      }}
    >
      <PdfIcon size={72} />
      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#333" }}>Download PDF</span>
    </a>
  );
}

function PdfIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 4h26l10 10v46a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="#e74c3c" />
      <path d="M40 4v10h10" fill="#c0392b" />
      <text x="32" y="46" fontSize="15" fontWeight="700" fill="#fff" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif">
        PDF
      </text>
    </svg>
  );
}
