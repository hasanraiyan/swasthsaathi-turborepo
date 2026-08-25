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
  createConditionSchema,
  listConditionsSchema,
  updateConditionSchema,
} from '@repo/contracts';
import type { Actor } from '@repo/contracts';

import { CurrentActor } from '../../auth/actor.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { parseInput } from '../../common/validation';
import { ConditionsService } from './conditions.service';

@UseGuards(ClerkAuthGuard)
@Controller('conditions')
export class ConditionsController {
  constructor(private readonly conditions: ConditionsService) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.conditions.list(actor, parseInput(listConditionsSchema, query));
  }

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.conditions.get(actor, parseInput(byIdSchema, { id }));
  }

  @Post()
  create(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.conditions.create(
      actor,
      parseInput(createConditionSchema, body),
    );
  }

  @Patch(':id')
  update(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: object,
  ) {
    return this.conditions.update(
      actor,
      parseInput(updateConditionSchema, { ...body, id }),
    );
  }

  @Delete(':id')
  remove(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.conditions.remove(actor, parseInput(byIdSchema, { id }));
  }
}
