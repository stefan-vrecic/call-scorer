/**
 * CLI to run Stage 1 against one transcript file and inspect the raw
 * evidence JSON - CLI first, no UI, per the plan. Also saves the output to
 * dev-output/ (gitignored) so later phases (validator, Stage 2) can be
 * developed against a real saved response without re-calling the API.
 *
 * Usage: npm run stage1 -- <kickoff|coaching> <path-to-transcript.txt>
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { runStage1 } from "../src/pipeline/stage1";
import type { CallType } from "../src/types/rubric";

async function main() {
  const [, , callTypeArg, transcriptPathArg] = process.argv;

  if (!callTypeArg || !transcriptPathArg || (callTypeArg !== "kickoff" && callTypeArg !== "coaching")) {
    console.error("Usage: npm run stage1 -- <kickoff|coaching> <path-to-transcript.txt>");
    process.exit(1);
  }

  const callType = callTypeArg as CallType;
  const transcript = readFileSync(transcriptPathArg, "utf-8");

  console.error(`Running Stage 1 (${callType}) on ${transcriptPathArg} (${transcript.length} chars)...`);
  const start = Date.now();
  const { output, indexed } = await runStage1(callType, transcript);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.error(`Done in ${elapsed}s. ${indexed.lines.length} lines indexed. ${output.dimensions.length} dimensions returned.`);

  const outDir = join(process.cwd(), "dev-output");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `stage1-${basename(transcriptPathArg, ".txt")}.json`);
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.error(`Saved to ${outPath}`);

  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error("Stage 1 failed:", err);
  process.exit(1);
});
