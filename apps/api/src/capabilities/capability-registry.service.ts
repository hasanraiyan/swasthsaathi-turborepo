import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import type {
  Actor,
  CapabilityDescriptor,
  CapabilityKind,
} from '@repo/contracts';
import { z } from 'zod';

import { InvalidInputError, NotFoundError } from '../common/errors';
import {
  type CapabilityBinding,
  isCapabilityProvider,
} from './capability.types';

/**
 * A capability rendered in the shape a tool-calling client expects.
 * This is exactly what an MCP `tools/list` response needs, which is the
 * point: the agent layer will be a transport over this, not a rewrite.
 */
export interface CapabilityToolDefinition {
  name: string;
  description: string;
  kind: CapabilityKind;
  inputSchema: unknown;
}

/**
 * The catalogue of everything Swasthya Saathi can do.
 *
 * Domain services declare their capabilities; this collects them at startup
 * and offers one uniform way to describe and invoke them. The REST
 * controllers are a thin adapter over the same services, and a future agent
 * will be another adapter over this registry -- neither owns business logic.
 */
@Injectable()
export class CapabilityRegistry implements OnModuleInit {
  private readonly logger = new Logger(CapabilityRegistry.name);
  private readonly bindings = new Map<string, CapabilityBinding>();

  constructor(private readonly discovery: DiscoveryService) {}

  onModuleInit(): void {
    for (const wrapper of this.discovery.getProviders()) {
      const instance: unknown = wrapper.instance;
      if (!isCapabilityProvider(instance)) {
        continue;
      }
      for (const binding of instance.capabilities()) {
        const { name } = binding.descriptor;
        if (this.bindings.has(name)) {
          throw new Error(
            `Duplicate capability "${name}". Capability names are the future tool names and must be unique.`,
          );
        }
        this.bindings.set(name, binding);
      }
    }
    this.logger.log(`Registered ${this.bindings.size} capabilities`);
  }

  /** Every capability, sorted by name. */
  list(): CapabilityDescriptor[] {
    return [...this.bindings.values()]
      .map((binding) => binding.descriptor)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  has(name: string): boolean {
    return this.bindings.has(name);
  }

  /**
   * Every capability as a JSON Schema tool definition.
   *
   * `io: 'input'` matters: it emits the schema as it accepts data, so fields
   * with defaults show as optional rather than required.
   */
  describe(): CapabilityToolDefinition[] {
    return this.list().map((descriptor) => ({
      name: descriptor.name,
      description: descriptor.description,
      kind: descriptor.kind,
      inputSchema: this.toJsonSchema(descriptor),
    }));
  }

  /**
   * Run a capability by name on behalf of an actor.
   *
   * Input is validated against the descriptor's schema here, so an HTTP
   * request and an agent tool call are held to exactly the same contract.
   */
  async invoke(
    name: string,
    actor: Actor,
    rawInput: unknown,
  ): Promise<unknown> {
    const binding = this.bindings.get(name);
    if (!binding) {
      throw new NotFoundError(`Unknown capability "${name}"`);
    }

    const parsed = binding.descriptor.input.safeParse(rawInput ?? {});
    if (!parsed.success) {
      throw new InvalidInputError(
        `Invalid input for "${name}"`,
        formatIssues(parsed.error),
      );
    }

    return binding.handler(actor, parsed.data);
  }

  private toJsonSchema(descriptor: CapabilityDescriptor): unknown {
    try {
      return z.toJSONSchema(descriptor.input, { io: 'input' });
    } catch (error) {
      // A schema that can't be expressed as JSON Schema is a bug worth
      // surfacing, but it shouldn't take down the whole catalogue.
      this.logger.warn(
        `Could not render JSON Schema for "${descriptor.name}": ${String(error)}`,
      );
      return { type: 'object', additionalProperties: true };
    }
  }
}

export function formatIssues(
  error: z.ZodError,
): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.') || '(root)',
    message: issue.message,
  }));
}
