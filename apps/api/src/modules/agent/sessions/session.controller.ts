import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  byIdSchema,
  createSessionSchema,
  listSessionsSchema,
  updateSessionTitleSchema,
} from '@repo/contracts';
import type { Actor } from '@repo/contracts';

import { CurrentActor } from '../../../auth/actor.decorator';
import { ClerkAuthGuard } from '../../../auth/clerk-auth.guard';
import { parseInput } from '../../../common/validation';
import { AgentService } from '../agent.service';
import { SessionService } from './session.service';

@UseGuards(ClerkAuthGuard)
@Controller('sessions')
export class SessionController {
  constructor(
    private readonly sessions: SessionService,
    private readonly agent: AgentService,
  ) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.sessions.list(actor, parseInput(listSessionsSchema, query));
  }

  @Post()
  create(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.sessions.create(actor, parseInput(createSessionSchema, body));
  }

  /** Declared before `:id` so "all" is never read as a session id. */
  @Delete('all')
  clear(@CurrentActor() actor: Actor) {
    return this.sessions.clear(actor);
  }

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.sessions.get(actor, parseInput(byIdSchema, { id }));
  }

  /** Turns come from the graph's own state, not a table of our own. */
  @Get(':id/messages')
  messages(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.agent.messages(actor, parseInput(byIdSchema, { id }).id);
  }

  @Patch(':id/title')
  updateTitle(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: object,
  ) {
    return this.sessions.updateTitle(
      actor,
      parseInput(updateSessionTitleSchema, { ...body, id }),
    );
  }

  @Delete(':id')
  remove(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.sessions.remove(actor, parseInput(byIdSchema, { id }));
  }
}
