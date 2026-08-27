import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { byIdSchema, listVoiceCallsSchema } from '@repo/contracts';
import type { Actor } from '@repo/contracts';

import { CurrentActor } from '../../auth/actor.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { parseInput } from '../../common/validation';
import { VoiceCallLogService } from './voice-call-log.service';

/** Past voice calls: the "Calls" list and a single call's transcript. */
@UseGuards(ClerkAuthGuard)
@Controller('voice/calls')
export class VoiceCallLogController {
  constructor(private readonly logs: VoiceCallLogService) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.logs.list(actor, parseInput(listVoiceCallsSchema, query));
  }

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.logs.get(actor, parseInput(byIdSchema, { id }));
  }
}
