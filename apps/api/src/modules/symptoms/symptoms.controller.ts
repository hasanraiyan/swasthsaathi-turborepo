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
  createSymptomEntrySchema,
  listSymptomEntriesSchema,
  updateSymptomEntrySchema,
} from '@repo/contracts';
import type { Actor } from '@repo/contracts';

import { CurrentActor } from '../../auth/actor.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { parseInput } from '../../common/validation';
import { SymptomsService } from './symptoms.service';

@UseGuards(ClerkAuthGuard)
@Controller('symptoms')
export class SymptomsController {
  constructor(private readonly symptoms: SymptomsService) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.symptoms.list(
      actor,
      parseInput(listSymptomEntriesSchema, query),
    );
  }

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.symptoms.get(actor, parseInput(byIdSchema, { id }));
  }

  @Post()
  log(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.symptoms.log(actor, parseInput(createSymptomEntrySchema, body));
  }

  @Patch(':id')
  update(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: object,
  ) {
    return this.symptoms.update(
      actor,
      parseInput(updateSymptomEntrySchema, { ...body, id }),
    );
  }

  @Delete(':id')
  remove(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.symptoms.remove(actor, parseInput(byIdSchema, { id }));
  }
}
