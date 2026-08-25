import { tool } from '@langchain/core/tools';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { Actor } from '@repo/contracts';

import type { CapabilityRegistry } from '../../../capabilities/capability-registry.service';
import { DomainError } from '../../../common/errors';

/**
 * The capability catalogue, as tools the agent can call.
 *
 * This is what the registry was built for: the descriptor already carries a
 * name, a description and a Zod schema, and `invoke` already validates the
 * input and scopes it to the acting user. The agent adds no business logic --
 * it chooses which capability to call and with what.
 */

/**
 * OpenAI restricts function names to `[a-zA-Z0-9_-]`, and every capability
 * here is dotted (`medicines.create`). The dot becomes a double underscore,
 * which no capability name contains, so the mapping back is unambiguous.
 * Nothing checks this client-side: a dotted name simply fails at the API.
 */
export function toToolName(capabilityName: string): string {
  return capabilityName.replace(/\./g, '__');
}

export function fromToolName(toolName: string): string {
  return toolName.replace(/__/g, '.');
}

export interface AgentToolset {
  tools: StructuredToolInterface[];
  /** Tool names that change the health record, for `interruptOn`. */
  writeToolNames: string[];
}

export function buildToolset(
  registry: CapabilityRegistry,
  actor: Actor,
): AgentToolset {
  const tools: StructuredToolInterface[] = [];
  const writeToolNames: string[] = [];

  for (const descriptor of registry.list()) {
    const name = toToolName(descriptor.name);
    if (descriptor.kind === 'write') {
      writeToolNames.push(name);
    }

    tools.push(
      tool(
        async (args: unknown) => {
          try {
            const result = await registry.invoke(descriptor.name, actor, args);
            return JSON.stringify(result ?? { ok: true });
          } catch (error) {
            // Returned rather than thrown: "no medicine by that name" is
            // something the model should read and respond to, not a reason
            // to end the conversation.
            const message =
              error instanceof DomainError
                ? error.message
                : 'That did not work.';
            return JSON.stringify({ error: message });
          }
        },
        {
          name,
          description: descriptor.description,
          // The contract's own Zod schema, so the tool and the REST route can
          // never disagree about what the capability accepts.
          schema: descriptor.input,
        },
      ) as StructuredToolInterface,
    );
  }

  return { tools, writeToolNames };
}
