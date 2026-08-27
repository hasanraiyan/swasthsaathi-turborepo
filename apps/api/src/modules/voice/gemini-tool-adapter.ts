import { Logger } from '@nestjs/common';
import type {
  FunctionCall,
  FunctionDeclaration,
  FunctionResponse,
} from '@google/genai';
import type { Actor } from '@repo/contracts';

import type { CapabilityRegistry } from '../../capabilities/capability-registry.service';
import { DomainError } from '../../common/errors';

const logger = new Logger('VoiceTools');

/**
 * A call-control action, not a domain capability -- there is no equivalent
 * of "hang up" in `CapabilityRegistry`, and there shouldn't be: it's specific
 * to a live voice session, not something text chat or any other actor could
 * ever mean. Handled directly in `voice-call.service.ts` rather than routed
 * through `handleFunctionCalls` below.
 */
export const END_CALL_TOOL_NAME = 'end_call';

export const END_CALL_FUNCTION_DECLARATION: FunctionDeclaration = {
  name: END_CALL_TOOL_NAME,
  description:
    "End the phone call. Call this once the conversation has reached a natural " +
    "close -- the person says goodbye, confirms they're done, or clearly asks " +
    'to hang up. Say a brief goodbye out loud first, then call this; do not ' +
    'call it mid-conversation or while a question is still open.',
  parametersJsonSchema: { type: 'object', properties: {} },
};

/**
 * The capability catalogue, as Gemini function declarations.
 *
 * Unlike `agent/llm/tool-adapter.ts` (LangChain, OpenAI-style names), Gemini's
 * function names explicitly permit dots, colons and dashes -- so a
 * capability's own name (`medicines.create`) is used unchanged, with no
 * name-mangling round trip needed.
 */
export function buildFunctionDeclarations(
  registry: CapabilityRegistry,
): FunctionDeclaration[] {
  return registry.describe().map((tool) => ({
    name: tool.name,
    description: tool.description,
    // The registry already renders the capability's Zod schema as JSON
    // Schema; Gemini accepts that as-is via `parametersJsonSchema`, which is
    // mutually exclusive with the Gemini-specific `parameters` field.
    parametersJsonSchema: tool.inputSchema,
  }));
}

/**
 * Run every function call Gemini asked for in one turn and shape the results
 * back into `FunctionResponse`s, the same way `tool-adapter.ts` folds a
 * `DomainError` into a message the model reads rather than a thrown error
 * that would end the call.
 */
export async function handleFunctionCalls(
  registry: CapabilityRegistry,
  actor: Actor,
  calls: FunctionCall[],
): Promise<FunctionResponse[]> {
  return Promise.all(
    calls.map(async (call): Promise<FunctionResponse> => {
      try {
        const result = await registry.invoke(call.name ?? '', actor, call.args);
        logger.log(`Tool ${call.name} succeeded for ${actor.userId}.`);
        return {
          id: call.id,
          name: call.name,
          response: { output: result ?? { ok: true } },
        };
      } catch (error) {
        const message =
          error instanceof DomainError ? error.message : 'That did not work.';
        logger.warn(
          `Tool ${call.name} failed for ${actor.userId}: ${String(error)}`,
        );
        return { id: call.id, name: call.name, response: { error: message } };
      }
    }),
  );
}
