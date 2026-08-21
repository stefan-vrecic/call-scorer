/**
 * Synthesis: finished report data -> brief + redFlags + oneThingExplanation.
 * Same forced-tool-call + Zod-validate pattern as Stage 1/2 (see toolCall.ts),
 * reused for consistency. The input here is deliberately narrow: only the
 * already-validated, already-scored per-dimension output (name, score,
 * maxScore, reasoning, quickFix, cappedBy, scoreClampReason,
 * insufficientEvidence, disabled/disabledReason), the already-computed
 * call-level totals/band/caps, and the already-selected oneThing candidate -
 * never the raw transcript, never raw Stage 1 evidence quotes. This call
 * can't invent a claim beyond what's already here because it isn't given
 * anything else to draw from.
 */

import Anthropic from "@anthropic-ai/sdk";
import { SynthesisOutputSchema, type SynthesisOutput } from "@/types/evaluation";
import { buildSynthesisSystemPrompt } from "./synthesisPrompt";
import { callToolWithRetry } from "./toolCall";
import { MODEL, SYNTHESIS_MAX_TOKENS } from "@/config";
import type { CallType } from "@/types/rubric";
import type { ReportDimension, AppliedCap, SignalCorrection } from "@/types/report";

const TOOL_NAME = "report_synthesis";

/** The oneThing candidate minus `explanation` - this call is what produces that field, so it can't already have one. */
export interface OneThingCandidate {
  dimensionId: string;
  dimensionName: string;
  currentScore: number;
  potentialScore: number;
  currentTotal: number;
  potentialTotal: number;
  potentialBand: string;
}

export interface SynthesisInput {
  callType: CallType;
  dimensions: ReportDimension[];
  rawTotal: number;
  total: number;
  maxPossible: number;
  band: string;
  appliedCaps: AppliedCap[];
  /** Already selected by scoring/oneThing.ts - null when every scored dimension is already at its max. */
  oneThingCandidate: OneThingCandidate | null;
  /** Already applied by signalConsistency.ts before this call runs - see that file. Usually empty. */
  signalCorrections: SignalCorrection[];
}

function buildToolInputSchema(hasOneThing: boolean) {
  const properties: Record<string, unknown> = {
    brief: {
      type: "string",
      description: "3-6 sentence summary of how the call went overall, grounded only in the dimension data given.",
    },
    redFlags: {
      type: "array",
      items: { type: "string" },
      description: "Short plain-English callouts of the most concerning things about this call. Empty array if none.",
    },
  };
  const required = ["brief", "redFlags"];

  if (hasOneThing) {
    properties.oneThingExplanation = {
      type: "string",
      description: "One short explanation of why the given one-thing candidate is the highest-leverage fix, referencing the numbers given.",
    };
    required.push("oneThingExplanation");
  }

  return { type: "object", properties, required } as const;
}

function formatDimension(d: ReportDimension): string {
  if (d.disabled) {
    return `### ${d.id} - ${d.name}\ndisabled: true\ndisabledReason: ${d.disabledReason ?? "(none given)"}`;
  }

  const lines = [
    `### ${d.id} - ${d.name}`,
    `score: ${d.score}/${d.maxScore}`,
    `reasoning: ${d.reasoning}`,
    `quickFix: ${d.quickFix}`,
  ];
  if (d.cappedBy) lines.push(`cappedBy: ${d.cappedBy}`);
  if (d.scoreClampReason) lines.push(`scoreClampReason: ${d.scoreClampReason}`);
  if (d.insufficientEvidence) lines.push(`insufficientEvidence: true`);
  return lines.join("\n");
}

function formatUserContent(input: SynthesisInput): string {
  const capsText =
    input.appliedCaps.length > 0
      ? input.appliedCaps.map((c) => `- ${c.id}: ${c.condition} (${c.effect.type})`).join("\n")
      : "(none fired)";

  const oneThingText = input.oneThingCandidate
    ? [
        `dimension: ${input.oneThingCandidate.dimensionName} (${input.oneThingCandidate.dimensionId})`,
        `currentScore -> potentialScore: ${input.oneThingCandidate.currentScore} -> ${input.oneThingCandidate.potentialScore}`,
        `currentTotal -> potentialTotal: ${input.oneThingCandidate.currentTotal} -> ${input.oneThingCandidate.potentialTotal}`,
        `potentialBand: ${input.oneThingCandidate.potentialBand}`,
      ].join("\n")
    : "(none - every scored dimension is already at its max, nothing to recommend)";

  const sections = [
    `Call type: ${input.callType}`,
    `Total: ${input.total}/${input.maxPossible} (raw total before caps: ${input.rawTotal}) - band: ${input.band}`,
    `Caps that fired:\n${capsText}`,
    `--- Dimensions (already scored, already final) ---\n\n${input.dimensions.map(formatDimension).join("\n\n")}`,
    `--- One-thing candidate (already selected deterministically - do not change or second-guess it) ---\n${oneThingText}`,
  ];

  if (input.signalCorrections.length > 0) {
    const correctionsText = input.signalCorrections
      .map((c) => `- ${c.signal}: reported ${c.reportedValue}, corrected to ${c.correctedValue} because ${c.reason}`)
      .join("\n");
    sections.push(
      `--- Data-quality note (already resolved deterministically, mention it plainly if it's relevant to the brief or red flags) ---\n${correctionsText}`,
    );
  }

  return sections.join("\n\n");
}

export async function runSynthesis(input: SynthesisInput): Promise<SynthesisOutput> {
  const hasOneThing = input.oneThingCandidate !== null;
  const system = buildSynthesisSystemPrompt();
  const userContent = formatUserContent(input);

  const client = new Anthropic();
  return callToolWithRetry({
    client,
    request: {
      model: MODEL,
      max_tokens: SYNTHESIS_MAX_TOKENS,
      system,
      messages: [{ role: "user", content: userContent }],
      tools: [
        {
          name: TOOL_NAME,
          description: "Report the synthesis output (brief, redFlags, and oneThingExplanation if applicable) for this call.",
          input_schema: buildToolInputSchema(hasOneThing) as unknown as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
    },
    toolName: TOOL_NAME,
    schema: SynthesisOutputSchema,
  });
}
