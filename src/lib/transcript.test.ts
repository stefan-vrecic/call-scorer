import { test } from "node:test";
import assert from "node:assert/strict";
import { indexTranscript, getLine } from "./transcript";

test("indexes lines starting at 1, and getLine round-trips the original text", () => {
  const raw = "[Dana]: Hey, is this Owen?\n[Owen]: Yeah, that's me.\n[Dana]: Great, how's it going?";
  const indexed = indexTranscript(raw);
  assert.equal(indexed.lines.length, 3);
  assert.equal(getLine(indexed, 1), "[Dana]: Hey, is this Owen?");
  assert.equal(getLine(indexed, 3), "[Dana]: Great, how's it going?");
  assert.ok(indexed.indexedText.startsWith("[1] [Dana]: Hey, is this Owen?"));
});

test("drops blank lines rather than assigning them a line number", () => {
  const raw = "[Dana]: Hello\n\n\n[Owen]: Hi";
  const indexed = indexTranscript(raw);
  assert.equal(indexed.lines.length, 2);
  assert.equal(getLine(indexed, 2), "[Owen]: Hi");
});

test("zero-pads line numbers to a consistent width for large transcripts", () => {
  const raw = Array.from({ length: 150 }, (_, i) => `[Speaker]: line ${i + 1}`).join("\n");
  const indexed = indexTranscript(raw);
  assert.ok(indexed.indexedText.startsWith("[001] "));
  assert.ok(indexed.indexedText.includes("[150] "));
});
