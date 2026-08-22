/**
 * Client-only "remember what I submitted" via localStorage - NOT a server-
 * side tracking mechanism (no IP logging, no fingerprinting). Deliberately
 * scoped to "this browser remembers its own submissions" rather than any
 * cross-device/cross-user identification: the app has no auth by design (see
 * db/schema.sql's RLS note), so anything IP- or fingerprint-based risks
 * showing one person's run to a different person on the same network - a
 * real privacy leak, not a hypothetical one, given a report can contain
 * identifiable client conversation details. localStorage has none of that
 * risk (never leaves the browser, no new backend/schema needed) at the cost
 * of not following the user to a different device - the right trade-off for
 * a no-auth tool.
 */

export interface RecentRun {
  id: string;
  callType: "kickoff" | "coaching";
  createdAt: string;
}

const STORAGE_KEY = "callscorer_recent_runs";
const MAX_RECENT_RUNS = 10;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getRecentRuns(): RecentRun[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // corrupted/foreign localStorage value - treat as empty rather than throw
  }
}

/** Call right after a run is successfully created (or deduped onto an existing one) - most-recent-first, deduped by id, capped so this never grows unbounded. */
export function rememberRun(run: RecentRun): void {
  if (!isBrowser()) return;
  try {
    const existing = getRecentRuns().filter((r) => r.id !== run.id);
    const updated = [run, ...existing].slice(0, MAX_RECENT_RUNS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable (private browsing, quota, disabled) - this is
    // a nice-to-have, not a requirement, so fail silently rather than block
    // the actual submission the user is waiting on.
  }
}

export function forgetRun(id: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(getRecentRuns().filter((r) => r.id !== id)));
  } catch {
    // see rememberRun
  }
}
