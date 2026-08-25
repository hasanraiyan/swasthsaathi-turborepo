import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  getAdherenceSchema,
  getDayScheduleSchema,
  listDosesSchema,
  recordDoseSchema,
} from '@repo/contracts';
import type { Actor } from '@repo/contracts';

import { CurrentActor } from '../../auth/actor.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { parseInput } from '../../common/validation';
import { MedicationDosesService } from './medication-doses.service';

@UseGuards(ClerkAuthGuard)
@Controller('medication-doses')
export class MedicationDosesController {
  constructor(private readonly doses: MedicationDosesService) {}

  /** The home screen's data: what to take today and what's been taken. */
  @Get('day')
  day(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.doses.day(actor, parseInput(getDayScheduleSchema, query));
  }

  @Get('adherence')
  adherence(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.doses.adherence(actor, parseInput(getAdherenceSchema, query));
  }

  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.doses.list(actor, parseInput(listDosesSchema, query));
  }

  @Post(':id/record')
  record(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: object,
  ) {
    return this.doses.record(
      actor,
      parseInput(recordDoseSchema, { ...body, doseId: id }),
    );
  }
}
