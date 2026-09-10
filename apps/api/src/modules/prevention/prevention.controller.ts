import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { completeCheckSchema, listCheckHistorySchema } from '@repo/contracts';
import type { Actor } from '@repo/contracts';

import { CurrentActor } from '../../auth/actor.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { parseInput } from '../../common/validation';
import { PreventionService } from './prevention.service';

@ApiTags('Prevention')
@ApiBearerAuth('clerk-jwt')
@UseGuards(ClerkAuthGuard)
@Controller('prevention')
export class PreventionController {
  constructor(private readonly prevention: PreventionService) {}

  @ApiOperation({
    summary: 'Get Prevention Snapshot',
    description: 'Returns an overview of upcoming preventive health checks, overdue screenings, and vaccine statuses.',
  })
  @ApiResponse({ status: 200, description: 'Prevention snapshot' })
  @Get('snapshot')
  snapshot(@CurrentActor() actor: Actor) {
    return this.prevention.snapshot(actor);
  }

  @ApiOperation({
    summary: 'Get Preventive Care Plan',
    description: 'Returns the personalized preventive health protocol based on age, gender, and risk factors.',
  })
  @ApiResponse({ status: 200, description: 'Personalized preventive plan' })
  @Get('plan')
  plan(@CurrentActor() actor: Actor) {
    return this.prevention.plan(actor);
  }

  @ApiOperation({
    summary: 'List Check History',
    description: 'Returns historical completions of preventive health checks, dental exams, eye tests, and screenings.',
  })
  @ApiResponse({ status: 200, description: 'Check completion history' })
  @Get('history')
  history(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.prevention.history(
      actor,
      parseInput(listCheckHistorySchema, query),
    );
  }

  @ApiOperation({
    summary: 'Complete Preventive Check',
    description: 'Marks a screening, vaccination, or health check as completed with test results or notes.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['checkId'],
      properties: {
        checkId: { type: 'string', example: 'annual-lipid-profile' },
        completedAt: { type: 'string', example: '2026-09-08' },
        notes: { type: 'string', example: 'Total cholesterol normal' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Check marked complete' })
  @Post('complete')
  complete(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.prevention.complete(
      actor,
      parseInput(completeCheckSchema, body),
    );
  }
}
