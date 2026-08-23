/**
 * Runs the evidence validator against every saved dev-output/stage1-*.json
 * file (from `npm run stage1`) against its matching real transcript - no API
 * calls, no cost, just checking already-collected real Stage 1 output
 * against the actual transcript text. Prints per-call and aggregate stats,
 * as the sanity check for the provisional warn/fail thresholds in config.ts.
 *
 * Usage: npm run validate
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { indexTranscript } from "../src/lib/transcript";
import { validateStage1Output } from "../src/pipeline/evidenceValidator";
import type { Stage1Output } from "../src/types/evaluation";
import { kickoffRubric } from "../src/rubrics/kickoff";
import { coachingRubric } from "../src/rubrics/coaching";

const DEV_OUTPUT_DIR = join(process.cwd(), "dev-output");
const TRANSCRIPTS_DIR = join(process.cwd(), "..", "exercise-reference", "transcripts");

function main() {
  const files = readdirSync(DEV_OUTPUT_DIR).filter((f) => f.startsWith("stage1-") && f.endsWith(".json"));
  if (files.length === 0) {
    console.error(`No dev-output/stage1-*.json files found. Run "npm run stage1 -- <kickoff|coaching> <transcript>" first.`);
    process.exit(1);
  }

  let grandTotal = 0;
  let grandInvalid = 0;

  for (const file of files) {
    const transcriptName = basename(file, ".json").replace(/^stage1-/, "");
    const transcriptPath = join(TRANSCRIPTS_DIR, `${transcriptName}.txt`);

    const output: Stage1Output = JSON.parse(readFileSync(join(DEV_OUTPUT_DIR, file), "utf-8"));
    const transcript = indexTranscript(readFileSync(transcriptPath, "utf-8"));
    // Saved filenames are always <kickoff|coaching>-NN.txt (see scripts/runStage1.ts) - same convention the rubric-selection logic elsewhere in the app relies on.
    const rubric = transcriptName.startsWith("coaching") ? coachingRubric : kickoffRubric;

    const result = validateStage1Output(output, transcript, rubric);
    grandTotal += result.summary.totalEvidence;
    grandInvalid += result.summary.invalidEvidence;

    console.log(`\n=== ${transcriptName} ===`);
    console.log(
      `  evidence: ${result.summary.totalEvidence}  invalid: ${result.summary.invalidEvidence}  rate: ${(result.summary.invalidRate * 100).toFixed(1)}%  warning: ${result.summary.warning}  fail: ${result.summary.fail}`,
    );

    for (const dim of result.dimensions) {
      const invalidResults = dim.results.filter((r) => !r.valid);
      if (invalidResults.length > 0) {
        console.log(`  ${dim.dimensionId} (allEvidenceRejected=${dim.allEvidenceRejected}):`);
        for (const r of invalidResults) {
          console.log(`    - line ${r.line} [${r.reason}]: "${r.quote}"${r.foundAtLines ? ` (actually found at line(s): ${r.foundAtLines.join(", ")})` : ""}`);
        }
      }
    }
  }

  const grandRate = grandTotal > 0 ? (grandInvalid / grandTotal) * 100 : 0;
  console.log(`\n=== AGGREGATE ACROSS ALL ${files.length} SAVED RUNS ===`);
  console.log(`  total evidence: ${grandTotal}  total invalid: ${grandInvalid}  rate: ${grandRate.toFixed(1)}%`);
}

main();
