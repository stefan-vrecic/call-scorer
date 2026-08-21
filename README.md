## Engineering decisions & trade-offs (running notes - will be tidied into a proper README before submission)

Logged as they happen, phase by phase, so nothing has to be reconstructed from memory later.

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
