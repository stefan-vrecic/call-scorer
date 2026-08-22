# Call Scorer

Paste a kickoff or coaching call transcript, get it scored against BeaverMind's rubric (12 dimensions per call type, evidence checked before anything gets scored) and turned into a shareable report - total, band, "the one thing" to improve, red flags, and a downloadable PDF.

**Live:** https://call-scorer-inky.vercel.app
**Source spec** (reference only): [hiring-ai-dev-exercise](https://github.com/lukecala/hiring-ai-dev-exercise)

## How it works

1. **Stage 1 - evidence only.** The transcript is indexed into numbered lines; a forced tool call extracts each dimension's observed behaviour plus cited `{line, quote}` evidence. No scoring yet, and the rubric's bands/points are deliberately withheld so early observation isn't anchored toward a score.
2. **Evidence validator.** Every citation is checked against the actual transcript text at that line. Anything that doesn't match is stripped before it ever reaches scoring - "evidence or nothing," enforced in code, not just prompted for.
3. **Stage 2 - scoring.** A second call sees the full rubric (bands, points, calibration notes) plus only the *validated* evidence - never the raw transcript again - and scores each dimension with a quick fix.
4. **Deterministic rules - plain code, not the model.** Applies each rubric's automatic-cap table, computes the total and band, and figures out "the one thing" by simulating maxing each dimension (lifting any cap it would clear) and picking the largest score delta.
5. **Synthesis.** A small, strictly downstream call turns the already-final structured result into a brief + red flags. It cannot change a score, a cap, or the one-thing selection - only describe what's already decided.

Persistence is Supabase (RLS on, zero policies - only the server-side `service_role` key can touch it), the pipeline runs server-side after the initial response via Next's `after()` (closing the tab doesn't stop it), and the model is `claude-sonnet-5` (`src/config.ts`).

## Environment setup

The app won't boot without this - `src/lib/supabase.ts` throws on startup if either Supabase variable is missing, and every pipeline call needs a real Anthropic key. Create `.env.local` in the project root:

```bash
ANTHROPIC_API_KEY=sk-ant-...

# Supabase → Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role secret, not anon>
```

`SUPABASE_SERVICE_ROLE_KEY` is intentionally the `service_role` key, not `anon` - the `runs` table has RLS enabled with zero policies, so this is the only key that can read/write it at all. Never expose this key to the client; every Supabase access goes through `src/lib/supabase.ts` on the server only.

Then, against that same Supabase project, apply the schema once (SQL Editor, paste the contents of `db/schema.sql`, run). It's idempotent (`create table if not exists`, etc.) so re-running it later is harmless.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), paste (or drag/drop, or open from folder) a kickoff or coaching call transcript, and submit - or use the CLI scripts to run a specific stage without going through the UI/DB at all:

```bash
npm test                                                          # unit tests (43 currently)
npm run stage1 -- <kickoff|coaching> <path-to-transcript.txt>     # Stage 1 evidence extraction only
npm run validate                                                  # re-check saved dev-output/ against the real transcripts, no API cost
npm run pipeline -- <kickoff|coaching> <path-to-transcript.txt>   # full pipeline end to end, prints the report, no DB write
```

## Architecture & key decisions

- **Evidence is checked in code, not just prompted for.** Stage 1's citations are verified against the actual transcript before Stage 2 ever sees them; anything that doesn't match is dropped, not silently trusted.
- **Scoring is deterministic.** Caps, totals, bands, and "the one thing to improve" are all plain code (`applyRubricRules`, `computeOneThing`) - the model never self-applies a rule, it only reasons and writes prose.
- **Found and fixed a real inconsistency in the client's own rubric doc**: coaching's 12 dimensions sum to 105 points, not the 100/85 its own scope note claims. `maxPossible` is derived from the actual dimensions, not the stated totals.
- **The strongest bug of the build**: a Stage 1 call-level signal contradicted its own dimension's validated evidence, wrongly zeroing a real 5/5. Fixed with a deterministic correction that only trusts *validated* evidence - never a bare, unverified claim.
- **A bug only a live deployment could find**: a 60-second function timeout that 4 phases of thorough local testing never tripped, caught the first time a run actually needed a retry in production. Fixed and reverified live.
- **No auth, by design** - Supabase RLS is on with zero policies (only the server's service-role key can touch the data); sharing is by URL, matching "send this link to a colleague."
- **Deliberately out of scope**: concurrent double-submit races, and transcript formats other than the exercise's own `[Speaker]: text` shape.
- Every decision above was verified against real transcripts and a real deployment, not mocked - see [`ENGINEERING_LOG.md`](./ENGINEERING_LOG.md) for the full phase-by-phase record: every bug, every trade-off considered and rejected, and exactly how each fix was proven.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
