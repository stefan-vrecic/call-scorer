import { test } from "node:test";
import assert from "node:assert/strict";
import { hashTranscript } from "./transcriptHash";

test("identical (callType, transcript) hashes identically", () => {
  const a = hashTranscript("kickoff", "[Coach]: Hey there.\n[Client]: Hi!");
  const b = hashTranscript("kickoff", "[Coach]: Hey there.\n[Client]: Hi!");
  assert.equal(a, b);
});

test("same transcript, different call type, hashes differently", () => {
  const a = hashTranscript("kickoff", "[Coach]: Hey there.");
  const b = hashTranscript("coaching", "[Coach]: Hey there.");
  assert.notEqual(a, b);
});

test("even a single character difference hashes differently - strict duplicate check, not fuzzy", () => {
  const a = hashTranscript("kickoff", "[Coach]: Hey there.");
  const b = hashTranscript("kickoff", "[Coach]: Hey there!");
  assert.notEqual(a, b);
});

test("outer whitespace (trailing newline) does not count as a different transcript", () => {
  const a = hashTranscript("kickoff", "[Coach]: Hey there.");
  const b = hashTranscript("kickoff", "[Coach]: Hey there.\n\n");
  assert.equal(a, b);
});

test("produces a hex sha256 digest (64 hex chars)", () => {
  const hash = hashTranscript("kickoff", "anything");
  assert.match(hash, /^[0-9a-f]{64}$/);
});
