"use client";

import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MAX_TRANSCRIPT_LENGTH } from "@/config";

type CallType = "kickoff" | "coaching";

const MIN_TRANSCRIPT_LENGTH = 20;

// Loose on purpose - catches "kickoff-01.txt", "Kick_Off Call.txt",
// "coaching-02.txt", "Coach Session.txt", etc. A filename matching BOTH (or
// neither) patterns returns null - genuinely ambiguous, so say nothing
// rather than guess wrong with false confidence.
const KICKOFF_PATTERN = /kick[\s_-]?off/i;
const COACHING_PATTERN = /coach(ing)?/i;

function detectCallTypeFromFilename(name: string): CallType | null {
  const isKickoff = KICKOFF_PATTERN.test(name);
  const isCoaching = COACHING_PATTERN.test(name);
  if (isKickoff && !isCoaching) return "kickoff";
  if (isCoaching && !isKickoff) return "coaching";
  return null;
}

const CALL_TYPE_LABEL: Record<CallType, string> = { kickoff: "Kickoff call", coaching: "Coaching call" };

export default function Home() {
  const router = useRouter();
  const [callType, setCallType] = useState<CallType>("kickoff");
  const [transcript, setTranscript] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [detectedType, setDetectedType] = useState<CallType | null>(null);
  const [mismatchDismissed, setMismatchDismissed] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // True only when the filename confidently suggests ONE type and it
  // disagrees with whichever radio is currently selected - re-evaluated on
  // every render, so switching the radio (or loading a different file)
  // naturally clears it without needing separate reset logic.
  const typeMismatch = detectedType !== null && detectedType !== callType && !mismatchDismissed;

  // Reads the file as text client-side and drops it straight into the same
  // `transcript` state the textarea already uses - a file is just a second
  // way to fill that one field, not a separate code path/upload endpoint.
  // No server involved (nothing is ever "uploaded" - the eventual POST body
  // is identical whether the text came from typing, pasting, or a file).
  function loadFile(file: File) {
    setError(null);
    setMismatchDismissed(false);
    setDetectedType(detectCallTypeFromFilename(file.name));
    const reader = new FileReader();
    reader.onload = () => {
      setTranscript(typeof reader.result === "string" ? reader.result : "");
      setFileName(file.name);
    };
    reader.onerror = () => setError(`Couldn't read "${file.name}" as text.`);
    reader.readAsText(file);
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = ""; // allow re-selecting the same file later
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  }

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
      <p>Paste, drop, or open a kickoff or coaching call transcript below. It gets scored against the client&apos;s rubric, and you get a shareable link to the result.</p>

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

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          style={{
            position: "relative",
            border: dragActive ? "2px dashed #555" : "2px dashed transparent",
            borderRadius: 6,
            transition: "border-color 0.1s ease",
          }}
        >
          <textarea
            value={transcript}
            onChange={(e) => {
              setTranscript(e.target.value);
              setFileName(null); // manual edit after a file load - the loaded-file label would be stale
            }}
            placeholder="Paste the transcript here, or drag a .txt file in..."
            rows={18}
            required
            style={{ width: "100%", fontFamily: "ui-monospace, monospace", fontSize: "0.85rem", padding: "0.75rem", boxSizing: "border-box" }}
          />
          {dragActive && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(255,255,255,0.9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.95rem",
                color: "#555",
                pointerEvents: "none",
              }}
            >
              Drop the transcript file here
            </div>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept=".txt,.srt,.vtt,text/plain" onChange={handleFileInputChange} style={{ display: "none" }} />

        <p style={{ fontSize: "0.8rem", color: "#888", marginTop: "0.4rem" }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{ background: "none", border: "none", padding: 0, color: "#1a5f9e", cursor: "pointer", font: "inherit", textDecoration: "underline" }}
          >
            Open from folder
          </button>
          {" "}or drag a file onto the box above.
          {fileName && <> &middot; Loaded from <strong>{fileName}</strong></>}
        </p>

        {typeMismatch && detectedType && (
          <div style={{ border: "1px solid #d68910", borderRadius: 6, background: "#fef5e7", padding: "0.6rem 0.8rem", margin: "0.5rem 0", fontSize: "0.85rem" }}>
            <strong>&ldquo;{fileName}&rdquo; looks like a {CALL_TYPE_LABEL[detectedType].toLowerCase()}</strong>, but{" "}
            {CALL_TYPE_LABEL[callType].toLowerCase()} is selected above.
            <div style={{ marginTop: "0.4rem" }}>
              <button
                type="button"
                onClick={() => setCallType(detectedType)}
                style={{ marginRight: "0.6rem", padding: "0.3rem 0.7rem", fontSize: "0.8rem", cursor: "pointer" }}
              >
                Switch to {CALL_TYPE_LABEL[detectedType]}
              </button>
              <button
                type="button"
                onClick={() => setMismatchDismissed(true)}
                style={{ background: "none", border: "none", color: "#6b4a00", textDecoration: "underline", cursor: "pointer", fontSize: "0.8rem" }}
              >
                Keep as {CALL_TYPE_LABEL[callType]}
              </button>
            </div>
          </div>
        )}

        <p style={{ fontSize: "0.8rem", color: transcript.length > MAX_TRANSCRIPT_LENGTH ? "#c0392b" : "#888", marginTop: "0.2rem" }}>
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
