/**
 * Stage 1: transcript -> evidence. No scoring happens here - see
 * stage1Prompt.ts for why bands/criteria are deliberately withheld from this
 * call.
 *
 * DECISION: uses a forced (non-strict) tool call, not client.messages.parse +
 * output_config.format. The structured-output path was tried first and
 * consistently failed server-side with "Grammar compilation timed out" on
 * this schema (nested arrays: dimensions[].evidence[]) - reproduced twice,
 * not a fluke. A forced tool call skips that constrained-decoding step
 * entirely: Claude follows the schema as strong guidance instead of hard
 * grammar-constrained generation, and we still validate the result against
 * Stage1OutputSchema with Zod ourselves before trusting it - so correctness
 * doesn't depend on the server-side guarantee that was timing out anyway.
 */

import Anthropic from "@anthropic-ai/sdk";
import { kickoffRubric } from "@/rubrics/kickoff";
import { coachingRubric } from "@/rubrics/coaching";
import type { CallType, RubricContract } from "@/types/rubric";
import { Stage1OutputSchema, type Stage1Output } from "@/types/evaluation";
import { indexTranscript, type IndexedTranscript } from "@/lib/transcript";
import { buildStage1SystemPrompt } from "./stage1Prompt";
import { MODEL, STAGE1_MAX_TOKENS } from "@/config";

export interface Stage1Result {
  output: Stage1Output;
  /** Returned alongside the evidence because Phase 3's validator needs the same indexed lines to check citations against. */
  indexed: IndexedTranscript;
}

const TOOL_NAME = "report_evidence";

/**
 * Built per rubric, not hardcoded to the union of both. A first version of
 * this schema statically listed every signal from both rubrics, and on a
 * real kickoff call the model dutifully filled in several coaching-only
 * fields (nextCallBookedLive, longTermVisionConnected, ...) that were never
 * asked about - the system prompt correctly scoped which signals mattered,
 * but the tool schema didn't, so the model followed the schema's shape
 * instead. Scoping the schema itself to exactly this rubric's caps closes
 * that gap - there's no property for the model to fill in that this call
 * type's rubric doesn't actually define.
 */
function buildEvidenceToolInputSchema(rubric: RubricContract) {
  const signalProperties: Record<string, { type: string; description?: string }> = {};
  for (const cap of rubric.automaticCaps) {
    signalProperties[cap.signal] = { type: "boolean" };
  }
  const optionalDimension = rubric.dimensions.find((d) => d.optional && d.disableDetectionCriteria);
  if (optionalDimension) {
    signalProperties.movementCoachingDisabled = { type: "boolean" };
    signalProperties.movementCoachingDisabledReason = {
      type: "string",
      description: "Only meaningful when movementCoachingDisabled is true.",
    };
  }

  return {
    type: "object",
    properties: {
      dimensions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            dimensionId: { type: "string", description: "e.g. \"D1\"" },
            observed: { type: "boolean" },
            observedBehaviour: { type: "string" },
            evidence: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  line: { type: "integer" },
                  quote: {
                    type: "string",
                    description: "Exact verbatim substring of that line's spoken text - not the [NNN] prefix, not the speaker tag.",
                  },
                },
                required: ["line", "quote"],
              },
            },
            insufficientEvidence: { type: "boolean" },
          },
          required: ["dimensionId", "observed", "observedBehaviour", "evidence", "insufficientEvidence"],
        },
      },
      signals: {
        type: "object",
        description: "Call-level facts - exactly the ones this rubric defines, nothing else.",
        properties: signalProperties,
      },
    },
    required: ["dimensions", "signals"],
  } as const;
}

export async function runStage1(callType: CallType, transcript: string): Promise<Stage1Result> {
  const rubric = callType === "kickoff" ? kickoffRubric : coachingRubric;
  const indexed = indexTranscript(transcript);
  const system = buildStage1SystemPrompt(rubric);

  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: STAGE1_MAX_TOKENS,
    system,
    messages: [{ role: "user", content: indexed.indexedText }],
    tools: [
      {
        name: TOOL_NAME,
        description: "Report the Stage 1 evidence extraction result for this call.",
        input_schema: buildEvidenceToolInputSchema(rubric) as unknown as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );

  if (!toolUse) {
    throw new Error(`Stage 1: expected a ${TOOL_NAME} tool call, got stop_reason=${response.stop_reason}`);
  }

  const parsed = Stage1OutputSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new Error(`Stage 1: tool input did not match Stage1OutputSchema - ${parsed.error.message}`);
  }

  return { output: parsed.data, indexed };
}
