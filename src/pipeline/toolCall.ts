/**
 * Shared forced-tool-call + Zod-validate helper, used by both Stage 1 and
 * Stage 2. Retries on failure (no tool_use block, or the tool input doesn't
 * match the schema) before giving up - added after a real Stage 2 call came
 * back with a malformed `dimensions` field (a stringified, and separately
 * truncated/unparseable, blob instead of a real array) on a live run. Our
 * Zod validation caught it correctly and failed loudly, exactly as designed.
 *
 * Default is 3 attempts, not 1 retry - measured empirically, not guessed:
 * reproducing against kickoff-01's real Stage 2 input (the longest, most
 * evidence-dense of the 4 real transcripts) failed 3 of 4 times with this
 * exact malformation. That's not noise, and it's the flip side of a trade-
 * off already made in Phase 2: dropping strict/grammar-constrained
 * generation (output_config.format) because it was timing out on complex
 * schemas means occasionally paying for it here instead, on large/complex
 * payloads under the non-strict tool-call path that replaced it. Retrying is
 * proportionate, not a cover-up - every attempt is logged, and Stage 2's
 * prompt was also tightened (see stage2Prompt.ts) to ask for shorter
 * reasoning, which reduces payload size/complexity as well as improving the
 * report itself.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

export interface ToolCallParams<T> {
  client: Anthropic;
  request: Anthropic.MessageCreateParamsNonStreaming;
  toolName: string;
  schema: z.ZodType<T>;
  maxAttempts?: number;
}

export async function callToolWithRetry<T>({ client, request, toolName, schema, maxAttempts = 3 }: ToolCallParams<T>): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await client.messages.create(request);
    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (!toolUse) {
      lastError = new Error(`Expected a ${toolName} tool call, got stop_reason=${response.stop_reason}`);
      console.warn(`[${toolName}] attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`);
      continue;
    }

    const parsed = schema.safeParse(toolUse.input);
    if (parsed.success) {
      if (attempt > 1) console.warn(`[${toolName}] succeeded on retry (attempt ${attempt}/${maxAttempts})`);
      return parsed.data;
    }

    lastError = new Error(`Tool input did not match schema - ${parsed.error.message}`);
    console.warn(`[${toolName}] attempt ${attempt}/${maxAttempts} failed schema validation: ${parsed.error.message}`);
  }

  throw lastError ?? new Error(`${toolName}: exhausted ${maxAttempts} attempts with no response`);
}
