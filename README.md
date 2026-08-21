## Engineering decisions & trade-offs (running notes - will be tidied into a proper README before submission)

Logged as they happen, phase by phase, so nothing has to be reconstructed from memory later.

### Loom quick reference - strongest stories to tell, jump to the full writeup

- **A documented approach didn't work, and here's the investigation, not just the pivot.** Anthropic's own recommended structured-output mechanism (`output_config.format`) reliably failed server-side on this schema. Tried it, hit a 400, reproduced it a second time to rule out a fluke, then switched to a forced tool call + client-side Zod validation instead - and can explain *why* that's not a downgrade. → Phase 2, bullet 1.
- **A real bug the test fixtures caught before it shipped**, not after: "the one thing" simulator was comparing a dimension's raw Stage-2 score against its max instead of the capped/reported score - would have hidden the single highest-leverage fix on a call. → Phase 1 commit / conversation, the `computeOneThing` currentScore fix.
- **Found and fixed a real inconsistency in the client's own rubric document** (coaching's 12 dimensions sum to 105, not the 100 its own scope note claims) - a concrete example of not treating a source spec as gospel, deriving the correct behavior instead of guessing which number was right. → Phase 1, bullet 1.
- **A full failure-mode spec for evidence validation, decided in writing before any code**, specifically including the tempting shortcut *not* taken: a real quote cited at the wrong line does NOT get silently relocated to wherever it actually matches, because that would mean the pipeline fixing the model's own citation error instead of catching it. → Phase 3, bullet 1.
- **Used the evidence validator to root-cause a real failure instead of loosening the validator to pass it.** One transcript tripped the fail threshold; all 8 invalid citations traced to one exact pattern (the model ellipsis-joining two real-but-separate parts of a long line); fixed the prompt at the source, regenerated, watched the invalid rate fall from 21.6% to 0% on that transcript and 7.9%→2.1% in aggregate. Real before/after numbers, not a claimed fix. → Phase 3, bullets 5-7.
- **A reasoned, asymmetric threshold policy, argued through instead of picked arbitrarily** - warn cheaply and sensitively (doesn't stop anything), fail conservatively and only on both a rate AND an absolute-count floor (stops the run, so it needs to resist small-sample noise). → Phase 3, bullet 3.

### Phase 1 - rubric contracts + deterministic scoring

- **Coaching rubric point-total discrepancy.** The coaching rubric's own scope note claims totals of 100 (D4 active) / 85 (D4 disabled), but its 12 dimensions' own stated point values sum to 105 - verified against the source file directly, not a transcription error. 105 minus D4's 15 is 90, not 85 either. Resolved by deriving `maxPossible` from the sum of the dimensions actually being scored, rather than trusting the rubric's stated totals - so a perfect call always lands at exactly 100/100, and the D4-disabled denominator is a derived 90, not the rubric's stated 85. See `src/rubrics/coaching.ts` and `src/scoring/applyRubricRules.ts`.
- **D2 (Diagnostics Review) redistribution rule left out of scope.** The rubric says when D2 doesn't apply (non-milestone call, no video), "redistribute weight to D3 and D4" - a second, differently-shaped rescale on top of D4's. Deliberately not implemented; D2 is scored normally always, and its Fail/Surface bands naturally cover "no diagnostics happened this call."
- **"The one thing" is computed in code, not asked of the model.** Simulates raising each dimension to its rubric max (lifting any cap that was specifically constraining that same dimension, since maxing it out is logically inconsistent with the cap's own trigger condition still being true), recomputes the total via the same deterministic path used for real scoring, and picks the largest delta. The model only ever writes the explanatory sentence for whichever dimension the code already picked.
- **Caps, totals, and bands are 100% deterministic code**, not LLM judgment - both rubrics define their automatic-cap tables as hard rules, so a shared `applyCaps()` engine (behind rubric-specific `applyKickoffCaps()`/`applyCoachingCaps()` entry points) applies them the same way every run, rather than trusting a model to remember to self-apply them consistently.

### Phase 2 - Stage 1 evidence extraction

- **`client.messages.parse` + `output_config.format` (Anthropic's structured-output / constrained-decoding path) does not work for this schema.** Tried it first, since it's the documented "recommended" approach. It consistently failed server-side with `400 Grammar compilation timed out` on the Stage 1 schema's nested arrays (`dimensions[].evidence[]`) - reproduced twice against a real transcript, not a one-off. Switched to a forced (non-strict) tool call instead: `tool_choice: {type: "tool", name: ...}`, then validated the returned tool input against the same Zod schema (`Stage1OutputSchema.safeParse`) client-side. This keeps the schema-enforcement guarantee without depending on the grammar compiler that was timing out - the tradeoff is losing the server-side "guaranteed to validate" promise, in exchange for something that actually completes reliably. See `src/pipeline/stage1.ts`.
- **The evidence-extraction tool schema is built per rubric, not shared.** A first version statically listed every call-level signal from both rubrics in one schema. On a real kickoff call, the model filled in several coaching-only signals nobody asked about, because the tool schema offered them as available fields even though the system prompt correctly scoped to kickoff's 4 signals - the schema, not the prose, is what the model was actually following. Harmless downstream today (unused keys get ignored), but a real discipline gap, closed by generating the tool's signal properties from `rubric.automaticCaps` instead of a hardcoded union.
- **Stage 1's prompt deliberately withholds each dimension's scoring bands/criteria/point values** - only `whatToLookFor` + positive/negative signals are shown. Stage 1's only job is "what happened, cite the lines"; showing it the scoring scale risks anchoring its observations toward a score before Stage 2 (a separate call, working only from Stage 1's evidence) ever gets a turn to judge.
- **Known limitation: transcript format is assumed, not validated.** `indexTranscript()` treats every non-blank line as one speaking turn and doesn't check for the `[Speaker]: text` shape. Validated only against the exercise's own transcript format. A turn wrapped across multiple lines degrades citation granularity; a transcript with no line breaks at all would collapse every citation to "line 1," breaking the evidence-verification mechanism; a structured format (VTT/SRT, a platform's JSON export) isn't handled at all. No format-detection/normalization was built - deliberately out of scope given the exercise supplies exactly one format.
- **`insufficientEvidence: true` (the "I genuinely have nothing to judge this on" signal) has not yet been observed firing on real data.** Ran all 4 real transcripts; on every one, every dimension had at least something to cite - including cases correctly reported as `observed: false` backed by real evidence that the behavior explicitly didn't happen (e.g. coaching-02's coach saying outright "today isn't about screen-sharing footage"). That's a different, already-proven code path from "nothing at all to go on." Not a known bug - just an untested path, worth being precise about rather than over-claiming.

### Phase 3 - evidence validator

- **Failure-mode spec decided before writing any code:** a quote that doesn't match its cited line, a cited line that doesn't exist, and a quote that's real text but at the WRONG line, all fail the citation - none get silently corrected or relocated. In particular, a real quote found elsewhere in the transcript is NOT auto-relocated to where it actually matches; that would mean the pipeline fixing the model's citation for it, hiding a real reliability signal. The actual location (if found anywhere) is recorded as a diagnostic only, never used to pass the citation. Normalization is limited to whitespace collapsing and smart-quote flattening - no fuzzy matching, no partial-word matching, no edit-distance tolerance.
- **Zero valid evidence forces `insufficientEvidence: true`** for that dimension before Stage 2 ever sees it, even if Stage 1 claimed otherwise - this is the mechanism that makes "evidence or nothing" real rather than a prompt-only promise.
- **Warn/fail thresholds are asymmetric on purpose:** warning fires on `rate >= 8% OR count >= 3` (cheap, so sensitive); fail requires `rate >= 20% AND count >= 5` (expensive - stops the run - so conservative and gated on both a rate AND an absolute-count floor, so a couple of citations on a thin-evidence call can't fail a run on noise alone). Provisional, reasoned defaults - see `src/config.ts`.
- **Sanity-checked against all 4 real Stage 1 outputs, no new API cost** (`npm run validate` re-checks saved `dev-output/` JSON against the real transcripts). First pass: 3 of 4 transcripts came back at 2-6% invalid (comfortably under warning); kickoff-01 came back at 21.6% (8/37) - both thresholds tripped.
- **Root-caused the one fail case instead of adjusting the thresholds to hide it.** All 8 of kickoff-01's invalid citations were the exact same pattern: the model quoting a real opening clause and a real closing clause of one long, run-on transcript line, joined with "..." while skipping real content in between - technically-real words, wrong claim about being one continuous excerpt. Fixed at the source (the Stage 1 prompt now explicitly requires continuous quotes and tells the model to report two separate evidence entries instead of ellipsis-joining two parts of the same line) rather than loosening the validator to tolerate it, which would have been exactly the "silently normalize bad evidence" this validator exists to prevent.
- **Result after the fix, regenerating all 4 transcripts:** aggregate invalid rate dropped from 7.9% (12/151) to 2.1% (3/140); kickoff-01 went from 8 invalid to 0. Two ellipsis-joined citations survived regeneration on the other two transcripts (same lines as before a rerun) - expected, since the model isn't deterministic and one prompt instruction reduces a tendency, it doesn't guarantee zero occurrences. All 4 transcripts now sit comfortably under both thresholds; chasing full elimination of a residual ~2% stochastic pattern wasn't judged worth further iteration.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
