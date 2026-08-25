import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { deleteMemorySchema, writeMemorySchema } from '@repo/contracts';
import type { Actor } from '@repo/contracts';

import { CurrentActor } from '../../../auth/actor.decorator';
import { ClerkAuthGuard } from '../../../auth/clerk-auth.guard';
import { parseInput } from '../../../common/validation';
import { MemoryService } from './memory.service';

/**
 * What the assistant remembers, under the user's control.
 *
 * The same three operations the agent gets as tools, so a person can read and
 * remove anything being kept about them without going through the agent.
 */
@UseGuards(ClerkAuthGuard)
@Controller('memory')
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  @Get()
  list(@CurrentActor() actor: Actor) {
    return this.memory.list(actor);
  }

  @Delete()
  clear(@CurrentActor() actor: Actor) {
    return this.memory.clear(actor);
  }

  // A memory key may contain slashes, so the wildcard keeps
  // "conditions/diabetes" in one piece instead of splitting the path.
  @Put('*key')
  write(
    @CurrentActor() actor: Actor,
    @Param('key') key: string,
    @Body() body: object,
  ) {
    return this.memory.write(
      actor,
      parseInput(writeMemorySchema, { ...body, key }),
    );
  }

  @Delete('*key')
  remove(@CurrentActor() actor: Actor, @Param('key') key: string) {
    return this.memory.remove(actor, parseInput(deleteMemorySchema, { key }));
  }
}
