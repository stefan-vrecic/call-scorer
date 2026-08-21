/**
 * Stable hash of (callType, transcript) - lets Phase 6's create-run flow
 * check whether this exact transcript was already scored before spending
 * ~$0.10 and ~60-90s running the pipeline again. Genuine duplicate
 * detection only (identical text), not fuzzy/near-duplicate matching -
 * two transcripts differing by even one character hash differently, which
 * is the correct behavior here: this is for catching an accidental
 * double-submit or a literal re-paste, not for deciding two similar calls
 * are "the same."
 *
 * Only trims the transcript's outer whitespace before hashing (a trailing
 * newline shouldn't count as a different transcript) - no other
 * normalization, so this stays a strict duplicate check.
 */

import { createHash } from "node:crypto";
import type { CallType } from "@/types/rubric";

export function hashTranscript(callType: CallType, transcript: string): string {
  return createHash("sha256").update(`${callType}:${transcript.trim()}`).digest("hex");
}
