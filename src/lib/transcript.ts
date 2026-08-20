/**
 * Turns a raw transcript ("[Speaker]: what they said", one speaking turn per
 * line) into a numbered version the model can cite by line, and gives Phase 3
 * a way to look up what a cited line actually says. Line numbers are 1-based,
 * matching what's shown to the model - line 1 is lines[0].
 */

export interface IndexedTranscript {
  /** Original line text, no index prefix. lines[0] is line 1. */
  lines: string[];
  /** The numbered version actually sent to the model, e.g. "[003] [Coach]: ...". */
  indexedText: string;
}

export function indexTranscript(raw: string): IndexedTranscript {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const width = String(lines.length).length;
  const indexedText = lines.map((line, i) => `[${String(i + 1).padStart(width, "0")}] ${line}`).join("\n");

  return { lines, indexedText };
}

/** The original (non-prefixed) text of a 1-based line number, or undefined if out of range. */
export function getLine(transcript: IndexedTranscript, lineNumber: number): string | undefined {
  return transcript.lines[lineNumber - 1];
}
