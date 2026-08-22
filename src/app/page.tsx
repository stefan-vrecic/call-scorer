"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MAX_TRANSCRIPT_LENGTH } from "@/config";

type CallType = "kickoff" | "coaching";

const MIN_TRANSCRIPT_LENGTH = 20;

export default function Home() {
  const router = useRouter();
  const [callType, setCallType] = useState<CallType>("kickoff");
  const [transcript, setTranscript] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callType, transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong submitting the transcript.");
      router.push(`/runs/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "3rem 1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Call Scorer</h1>
      <p>Paste a kickoff or coaching call transcript below. It gets scored against the client&apos;s rubric, and you get a shareable link to the result.</p>

      <form onSubmit={handleSubmit}>
        <fieldset style={{ marginBottom: "1rem", border: "1px solid #ccc", borderRadius: 6, padding: "0.75rem 1rem" }}>
          <legend>Call type</legend>
          <label style={{ marginRight: "1.5rem" }}>
            <input type="radio" name="callType" value="kickoff" checked={callType === "kickoff"} onChange={() => setCallType("kickoff")} />
            {" "}Kickoff call
          </label>
          <label>
            <input type="radio" name="callType" value="coaching" checked={callType === "coaching"} onChange={() => setCallType("coaching")} />
            {" "}Coaching call
          </label>
        </fieldset>

        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste the transcript here..."
          rows={18}
          required
          style={{ width: "100%", fontFamily: "ui-monospace, monospace", fontSize: "0.85rem", padding: "0.75rem", boxSizing: "border-box" }}
        />

        <p style={{ fontSize: "0.8rem", color: transcript.length > MAX_TRANSCRIPT_LENGTH ? "#c0392b" : "#888", marginTop: "0.4rem" }}>
          {transcript.length.toLocaleString()} / {MAX_TRANSCRIPT_LENGTH.toLocaleString()} characters
          {transcript.length > MAX_TRANSCRIPT_LENGTH && " - too long for a single call transcript"}
        </p>

        {error && <p style={{ color: "#c0392b" }}>{error}</p>}

        <button
          type="submit"
          disabled={submitting || transcript.trim().length < MIN_TRANSCRIPT_LENGTH || transcript.length > MAX_TRANSCRIPT_LENGTH}
          style={{ marginTop: "1rem", padding: "0.6rem 1.4rem", fontSize: "1rem", cursor: "pointer" }}
        >
          {submitting ? "Submitting..." : "Score this call"}
        </button>
      </form>
    </main>
  );
}
