import type { Actor, CapabilityDescriptor } from '@repo/contracts';
import type { z } from 'zod';

/**
 * A capability descriptor joined to the code that actually performs it.
 *
 * The descriptor lives in `@repo/contracts` so the mobile app and a future
 * agent can both see it; the handler lives here, next to the data. Binding
 * them at runtime is what lets one implementation serve an HTTP controller
 * today and an MCP tool later without a second copy of the business logic.
 */
export interface CapabilityBinding<I extends z.ZodType = z.ZodType> {
  descriptor: CapabilityDescriptor<I>;
  handler: (actor: Actor, input: z.infer<I>) => Promise<unknown>;
}

/**
 * Implemented by every domain service that exposes capabilities.
 * `CapabilityRegistry` discovers these automatically -- a service does not
 * have to be registered anywhere by hand.
 */
export interface CapabilityProvider {
  capabilities(): CapabilityBinding[];
}

/**
 * Pair a descriptor with its handler, keeping the handler's `input` argument
 * typed from the descriptor's schema.
 *
 * The cast is deliberate: a `CapabilityBinding<SpecificSchema>` is not
 * assignable to `CapabilityBinding<z.ZodType>` because the handler's
 * parameter is contravariant. The registry only ever calls a handler with
 * data that schema just validated, so erasing the type at the boundary is
 * sound even though the compiler can't see it.
 */
export function bindCapability<I extends z.ZodType>(
  descriptor: CapabilityDescriptor<I>,
  handler: (actor: Actor, input: z.infer<I>) => Promise<unknown>,
): CapabilityBinding {
  return { descriptor, handler };
}

export function isCapabilityProvider(
  value: unknown,
): value is CapabilityProvider {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as CapabilityProvider).capabilities === 'function'
  );
}
