import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { completeCheckSchema, listCheckHistorySchema } from '@repo/contracts';
import type { Actor } from '@repo/contracts';

import { CurrentActor } from '../../auth/actor.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { parseInput } from '../../common/validation';
import { PreventionService } from './prevention.service';

@UseGuards(ClerkAuthGuard)
@Controller('prevention')
export class PreventionController {
  constructor(private readonly prevention: PreventionService) {}

  @Get('snapshot')
  snapshot(@CurrentActor() actor: Actor) {
    return this.prevention.snapshot(actor);
  }

  @Get('plan')
  plan(@CurrentActor() actor: Actor) {
    return this.prevention.plan(actor);
  }

  @Get('history')
  history(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.prevention.history(
      actor,
      parseInput(listCheckHistorySchema, query),
    );
  }

  @Post('complete')
  complete(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.prevention.complete(
      actor,
      parseInput(completeCheckSchema, body),
    );
  }
}
