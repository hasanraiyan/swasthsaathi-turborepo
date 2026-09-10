import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Actor } from '@repo/contracts';

import { CurrentActor } from '../auth/actor.decorator';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CapabilityRegistry } from './capability-registry.service';

/**
 * Introspection and generic invocation for the capability catalogue.
 */
@ApiTags('Capabilities')
@ApiBearerAuth('clerk-jwt')
@UseGuards(ClerkAuthGuard)
@Controller('capabilities')
export class CapabilitiesController {
  constructor(private readonly registry: CapabilityRegistry) {}

  /** The catalogue as JSON Schema tool definitions. */
  @ApiOperation({
    summary: 'List Registered Capabilities',
    description: 'Returns the full capability catalog as JSON Schema tool definitions for LLM function calling and MCP servers.',
  })
  @ApiResponse({ status: 200, description: 'List of registered capabilities' })
  @Get()
  list() {
    return { capabilities: this.registry.describe() };
  }

  /** Run any capability by name, with the same validation the REST routes use. */
  @ApiOperation({
    summary: 'Invoke Capability by Name',
    description: 'Executes a specific capability tool call with parameters validated against its contract schema.',
  })
  @ApiParam({ name: 'name', description: 'Capability tool name', example: 'medicines_list' })
  @ApiBody({
    schema: {
      type: 'object',
      description: 'Arguments required by the capability',
    },
  })
  @ApiResponse({ status: 200, description: 'Invocation result' })
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
