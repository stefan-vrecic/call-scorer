import { test } from "node:test";
import assert from "node:assert/strict";
import { indexTranscript } from "@/lib/transcript";
import { validateEvidenceItem, validateStage1Output } from "./evidenceValidator";
import type { Stage1Output } from "@/types/evaluation";
import { kickoffRubric } from "@/rubrics/kickoff";
import { coachingRubric } from "@/rubrics/coaching";

const transcript = indexTranscript(
  [
    "[Dana]: Hey, is this Owen?",
    "[Owen]: Yeah, that's me.",
    "[Dana]: Great, I saw from your notes you're dealing with a knee issue.",
    "[Owen]: Yeah, it's been about six months now.",
    "[Dana]: Let's book your next call — does Tuesday at 3pm work?",
  ].join("\n"),
);

test("valid citation: quote is a real substring of the cited line", () => {
  const result = validateEvidenceItem({ line: 3, quote: "I saw from your notes you're dealing with a knee issue" }, transcript);
  assert.equal(result.valid, true);
  assert.equal(result.reason, undefined);
});

test("case 1: quote does not match the cited line's text", () => {
  const result = validateEvidenceItem({ line: 3, quote: "does Tuesday at 3pm work" }, transcript);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "quote-not-found-on-line");
});

test("case 2: cited line does not exist (out of range)", () => {
  const result = validateEvidenceItem({ line: 500, quote: "anything" }, transcript);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "line-out-of-range");
});

test("case 2b: line 0 and negative lines are also out of range, not silently clamped", () => {
  assert.equal(validateEvidenceItem({ line: 0, quote: "Hey" }, transcript).reason, "line-out-of-range");
  assert.equal(validateEvidenceItem({ line: -1, quote: "Hey" }, transcript).reason, "line-out-of-range");
});

test("case 3: quote is real text but cited on the wrong line - fails, is NOT relocated to where it actually matches", () => {
  // "does Tuesday at 3pm work" really is on line 5, not line 1.
  const result = validateEvidenceItem({ line: 1, quote: "does Tuesday at 3pm work" }, transcript);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "quote-not-found-on-line");
  // The real location is recorded as a DIAGNOSTIC, not used to pass the citation.
  assert.deepEqual(result.foundAtLines, [5]);
});

test("normalization handles whitespace and smart quotes, but is not fuzzy", () => {
  // Multiple spaces + smart apostrophe in the quote, straight apostrophe in the source line.
  const result = validateEvidenceItem({ line: 2, quote: "Yeah,   that’s   me." }, transcript);
  assert.equal(result.valid, true);
});

test("normalization does not let a substantively different quote pass", () => {
  const result = validateEvidenceItem({ line: 2, quote: "Yeah, that's definitely not me." }, transcript);
  assert.equal(result.valid, false);
});

test("a dimension with zero evidence to begin with keeps Stage 1's own insufficientEvidence, not forced true from allEvidenceRejected", () => {
  const output: Stage1Output = {
    dimensions: [{ dimensionId: "D1", observed: false, observedBehaviour: "Nothing relevant found.", evidence: [], insufficientEvidence: true }],
    signals: {},
  };
  const result = validateStage1Output(output, transcript, kickoffRubric);
  const d1 = result.dimensions[0];
  assert.equal(d1.insufficientEvidence, true);
  assert.equal(d1.allEvidenceRejected, false); // Stage 1 never claimed evidence in the first place
});

test("a dimension where EVERY citation fails validation gets insufficientEvidence forced to true, even though Stage 1 said false", () => {
  const output: Stage1Output = {
    dimensions: [
      {
        dimensionId: "D3",
        observed: true,
        observedBehaviour: "Coach booked the next call.",
        evidence: [{ line: 999, quote: "fabricated" }],
        insufficientEvidence: false,
      },
    ],
    signals: {},
  };
  const result = validateStage1Output(output, transcript, kickoffRubric);
  const d3 = result.dimensions[0];
  assert.equal(d3.allEvidenceRejected, true);
  assert.equal(d3.insufficientEvidence, true);
  assert.equal(d3.validEvidence.length, 0);
});

test("a dimension with SOME valid and some invalid evidence keeps only the valid items, does not force insufficientEvidence", () => {
  const output: Stage1Output = {
    dimensions: [
      {
        dimensionId: "D3",
        observed: true,
        observedBehaviour: "Booking discussed.",
        evidence: [
          { line: 5, quote: "does Tuesday at 3pm work" }, // valid
          { line: 5, quote: "completely made up text" }, // invalid
        ],
        insufficientEvidence: false,
      },
    ],
    signals: {},
  };
  const result = validateStage1Output(output, transcript, kickoffRubric);
  const d3 = result.dimensions[0];
  assert.equal(d3.validEvidence.length, 1);
  assert.equal(d3.allEvidenceRejected, false);
  assert.equal(d3.insufficientEvidence, false);
});

test("aggregate summary: warning fires on rate OR count, fail requires rate AND count", () => {
  // 3 invalid out of 20 = 15% -> below fail rate (20%) but at/above warn count (3) -> warning, not fail.
  const dims: Stage1Output["dimensions"] = Array.from({ length: 20 }, (_, i) => ({
    dimensionId: `D${(i % 12) + 1}`,
    observed: true,
    observedBehaviour: "x",
    evidence: [{ line: i < 3 ? 999 : 1, quote: i < 3 ? "fabricated" : "Hey, is this Owen?" }],
    insufficientEvidence: false,
  }));
  const result = validateStage1Output({ dimensions: dims, signals: {} }, transcript, kickoffRubric);
  assert.equal(result.summary.totalEvidence, 20);
  assert.equal(result.summary.invalidEvidence, 3);
  assert.equal(result.summary.warning, true);
  assert.equal(result.summary.fail, false);
});

test("no evidence anywhere in the call -> invalidRate is 0, not NaN, no warning/fail", () => {
  const result = validateStage1Output({ dimensions: [], signals: {} }, transcript, kickoffRubric);
  assert.equal(result.summary.totalEvidence, 0);
  assert.equal(result.summary.invalidRate, 0);
  assert.equal(result.summary.warning, false);
  assert.equal(result.summary.fail, false);
});

// --- Cap-signal citation validation (ChatGPT review finding, closed here) ---
// kickoffRubric's "no-follow-up-questions" cap: signal noFollowUpQuestionsAnywhere, firesWhenSignalIs: true.

test("cap-firing signal with a citation that validates: trusted as-is, no issue recorded", () => {
  const output: Stage1Output = {
    dimensions: [],
    signals: { noFollowUpQuestionsAnywhere: { value: true, quote: "Hey, is this Owen?", line: 1 } },
  };
  const result = validateStage1Output(output, transcript, kickoffRubric);
  assert.equal(result.signals.noFollowUpQuestionsAnywhere, true);
  assert.equal(result.signalEvidenceIssues.length, 0);
});

test("cap-firing signal with NO citation: flipped to the non-firing default, issue recorded", () => {
  const output: Stage1Output = {
    dimensions: [],
    signals: { noFollowUpQuestionsAnywhere: { value: true } },
  };
  const result = validateStage1Output(output, transcript, kickoffRubric);
  assert.equal(result.signals.noFollowUpQuestionsAnywhere, false);
  assert.equal(result.signalEvidenceIssues.length, 1);
  assert.equal(result.signalEvidenceIssues[0].signal, "noFollowUpQuestionsAnywhere");
  assert.equal(result.signalEvidenceIssues[0].capId, "no-follow-up-questions");
  assert.equal(result.signalEvidenceIssues[0].reportedValue, true);
  assert.equal(result.signalEvidenceIssues[0].correctedValue, false);
});

test("cap-firing signal with a citation that fails validation: flipped, issue recorded", () => {
  const output: Stage1Output = {
    dimensions: [],
    signals: { clientUnresolvedConfusion: { value: true, quote: "completely fabricated quote", line: 1 } },
  };
  const result = validateStage1Output(output, transcript, kickoffRubric);
  assert.equal(result.signals.clientUnresolvedConfusion, false);
  assert.equal(result.signalEvidenceIssues.length, 1);
  assert.equal(result.signalEvidenceIssues[0].capId, "unresolved-confusion");
});

test("non-firing signal value requires no citation at all - passes through untouched", () => {
  const output: Stage1Output = {
    dimensions: [],
    signals: { noFollowUpQuestionsAnywhere: { value: false } },
  };
  const result = validateStage1Output(output, transcript, kickoffRubric);
  assert.equal(result.signals.noFollowUpQuestionsAnywhere, false);
  assert.equal(result.signalEvidenceIssues.length, 0);
});

test("a signal Stage 1 didn't report at all stays absent - unaffected by the new validation step", () => {
  const result = validateStage1Output({ dimensions: [], signals: {} }, transcript, kickoffRubric);
  assert.equal(result.signals.noFollowUpQuestionsAnywhere, undefined);
  assert.equal(result.signalEvidenceIssues.length, 0);
});

// --- movementCoachingDisabled: not a cap, but same citation bar (dropping a
// whole dimension is a bigger consequence than most caps) ---

test("movementCoachingDisabled=true with a valid citation: trusted, reason passed through unvalidated", () => {
  const output: Stage1Output = {
    dimensions: [],
    signals: {
      movementCoachingDisabled: { value: true, quote: "Hey, is this Owen?", line: 1 },
      movementCoachingDisabledReason: "no movement coaching on this call",
    },
  };
  const result = validateStage1Output(output, transcript, coachingRubric);
  assert.equal(result.signals.movementCoachingDisabled, true);
  assert.equal(result.signals.movementCoachingDisabledReason, "no movement coaching on this call");
  assert.equal(result.signalEvidenceIssues.length, 0);
});

test("movementCoachingDisabled=true with NO citation: flipped to false (D4 scores normally), issue recorded", () => {
  const output: Stage1Output = {
    dimensions: [],
    signals: { movementCoachingDisabled: { value: true }, movementCoachingDisabledReason: "no movement coaching on this call" },
  };
  const result = validateStage1Output(output, transcript, coachingRubric);
  assert.equal(result.signals.movementCoachingDisabled, false);
  assert.equal(result.signalEvidenceIssues.length, 1);
  assert.equal(result.signalEvidenceIssues[0].signal, "movementCoachingDisabled");
  // The reason is still passed through even when the disable itself gets reverted -
  // a reviewer can see what the model claimed, even though D4 is being scored anyway.
  assert.equal(result.signals.movementCoachingDisabledReason, "no movement coaching on this call");
});

test("movementCoachingDisabled=true with a citation that fails validation: flipped, issue recorded", () => {
  const output: Stage1Output = {
    dimensions: [],
    signals: { movementCoachingDisabled: { value: true, quote: "completely fabricated quote", line: 1 } },
  };
  const result = validateStage1Output(output, transcript, coachingRubric);
  assert.equal(result.signals.movementCoachingDisabled, false);
  assert.equal(result.signalEvidenceIssues.length, 1);
  assert.equal(result.signalEvidenceIssues[0].capId, "movement-coaching-disabled");
});

test("movementCoachingDisabled=false requires no citation - passes through untouched", () => {
  const output: Stage1Output = { dimensions: [], signals: { movementCoachingDisabled: { value: false } } };
  const result = validateStage1Output(output, transcript, coachingRubric);
  assert.equal(result.signals.movementCoachingDisabled, false);
  assert.equal(result.signalEvidenceIssues.length, 0);
});
