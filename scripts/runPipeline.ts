/**
 * Runs the full scoring pipeline (Stage 1 -> validate -> Stage 2 -> score-
 * validate -> deterministic rules -> one thing) end to end against one real
 * transcript. First time in the project a transcript goes all the way to an
 * actual total + band. Missing only brief/redFlags (Phase 5).
 *
 * Usage: npm run pipeline -- <kickoff|coaching> <path-to-transcript.txt>
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { runScoringPipeline } from "../src/pipeline/runPipeline";
import type { CallType } from "../src/types/rubric";

async function main() {
  const [, , callTypeArg, transcriptPathArg] = process.argv;

  if (!callTypeArg || !transcriptPathArg || (callTypeArg !== "kickoff" && callTypeArg !== "coaching")) {
    console.error("Usage: npm run pipeline -- <kickoff|coaching> <path-to-transcript.txt>");
    process.exit(1);
  }

  const callType = callTypeArg as CallType;
  const transcript = readFileSync(transcriptPathArg, "utf-8");

  console.error(`Running full pipeline (${callType}) on ${transcriptPathArg}...`);
  const start = Date.now();
  const report = await runScoringPipeline(callType, transcript);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.error(`Done in ${elapsed}s.`);
  console.error(`TOTAL: ${report.total.toFixed(1)}/100  BAND: ${report.band}  (raw ${report.rawTotal}/${report.maxPossible})`);
  console.error(`Applied caps: ${report.appliedCaps.map((c) => c.id).join(", ") || "none"}`);
  console.error(`Evidence warning: ${report.evidenceWarning}`);
  console.error(
    `One thing: ${report.oneThing ? `${report.oneThing.dimensionId} (${report.oneThing.currentScore} -> ${report.oneThing.potentialScore}, total ${report.oneThing.currentTotal.toFixed(1)} -> ${report.oneThing.potentialTotal.toFixed(1)}, band -> ${report.oneThing.potentialBand})` : "none - every dimension already maxed"}`,
  );

  const outDir = join(process.cwd(), "dev-output");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `report-${basename(transcriptPathArg, ".txt")}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.error(`Saved to ${outPath}`);
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
