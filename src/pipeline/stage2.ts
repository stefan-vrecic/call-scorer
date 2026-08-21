/**
 * Stage 2: validated evidence -> scores. Same forced-tool-call + client-side
 * Zod validation pattern as Stage 1 (src/pipeline/stage1.ts), reused
 * deliberately for consistency now that it's proven reliable - no reason to
 * reintroduce the output_config.format risk here even though this schema is
 * flatter (no nested arrays) and might not hit the same grammar-compilation
 * issue.
 */

import Anthropic from "@anthropic-ai/sdk";
import { kickoffRubric } from "@/rubrics/kickoff";
import { coachingRubric } from "@/rubrics/coaching";
import type { CallType } from "@/types/rubric";
import { Stage2OutputSchema, type Stage2Output } from "@/types/evaluation";
import type { DimensionValidationResult } from "./evidenceValidator";
import { buildStage2SystemPrompt } from "./stage2Prompt";
import { callToolWithRetry } from "./toolCall";
import { MODEL, STAGE2_MAX_TOKENS } from "@/config";

const TOOL_NAME = "report_scores";

function buildToolInputSchema(dimensionIds: string[]) {
  return {
    type: "object",
    properties: {
      dimensions: {
        type: "array",
        description: `Exactly one entry per dimension: ${dimensionIds.join(", ")}.`,
        items: {
          type: "object",
          properties: {
            dimensionId: { type: "string" },
            score: { type: "number" },
            reasoning: { type: "string" },
            quickFix: { type: "string" },
          },
          required: ["dimensionId", "score", "reasoning", "quickFix"],
        },
      },
    },
    required: ["dimensions"],
  } as const;
}

function formatDimensionInput(d: DimensionValidationResult): string {
  const evidenceText =
    d.validEvidence.length > 0
      ? d.validEvidence.map((e) => `  - [line ${e.line}] "${e.quote}"`).join("\n")
      : "  (none)";

  return [
    `### ${d.dimensionId}`,
    `Stage 1's observation: ${d.observedBehaviour}`,
    `insufficientEvidence: ${d.insufficientEvidence}`,
    `Evidence:`,
    evidenceText,
  ].join("\n");
}

export async function runStage2(
  callType: CallType,
  scoredDimensions: DimensionValidationResult[],
  disabledDimensionIds: string[],
): Promise<Stage2Output> {
  const rubric = callType === "kickoff" ? kickoffRubric : coachingRubric;
  const system = buildStage2SystemPrompt(rubric, disabledDimensionIds);
  const userContent = scoredDimensions.map(formatDimensionInput).join("\n\n");

  const client = new Anthropic();
  return callToolWithRetry({
    client,
    request: {
      model: MODEL,
      max_tokens: STAGE2_MAX_TOKENS,
      system,
      messages: [{ role: "user", content: userContent }],
      tools: [
        {
          name: TOOL_NAME,
          description: "Report the Stage 2 scoring result for this call.",
          input_schema: buildToolInputSchema(scoredDimensions.map((d) => d.dimensionId)) as unknown as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
    },
    toolName: TOOL_NAME,
    schema: Stage2OutputSchema,
  });
}
