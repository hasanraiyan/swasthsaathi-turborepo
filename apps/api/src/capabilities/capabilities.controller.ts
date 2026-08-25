import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { Actor } from '@repo/contracts';

import { CurrentActor } from '../auth/actor.decorator';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CapabilityRegistry } from './capability-registry.service';

/**
 * Introspection and generic invocation for the capability catalogue.
 *
 * The mobile app doesn't use these -- it calls the typed REST routes. They
 * exist so the capability surface is inspectable while the product is being
 * built, and so the eventual MCP server has a working reference for how a
 * tool call maps onto a service method.
 */
@UseGuards(ClerkAuthGuard)
@Controller('capabilities')
export class CapabilitiesController {
  constructor(private readonly registry: CapabilityRegistry) {}

  /** The catalogue as JSON Schema tool definitions. */
  @Get()
  list() {
    return { capabilities: this.registry.describe() };
  }

  /** Run any capability by name, with the same validation the REST routes use. */
  @Post(':name/invoke')
  async invoke(
    @Param('name') name: string,
    @CurrentActor() actor: Actor,
    @Body() body: unknown,
  ) {
    const result = await this.registry.invoke(name, actor, body);
    return { result };
  }
}
