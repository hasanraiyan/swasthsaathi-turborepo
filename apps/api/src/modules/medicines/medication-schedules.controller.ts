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
  createMedicationScheduleSchema,
  listMedicationSchedulesSchema,
  updateMedicationScheduleSchema,
} from '@repo/contracts';
import type { Actor } from '@repo/contracts';

import { CurrentActor } from '../../auth/actor.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { parseInput } from '../../common/validation';
import { MedicationSchedulesService } from './medication-schedules.service';

@UseGuards(ClerkAuthGuard)
@Controller('medication-schedules')
export class MedicationSchedulesController {
  constructor(private readonly schedules: MedicationSchedulesService) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.schedules.list(
      actor,
      parseInput(listMedicationSchedulesSchema, query),
    );
  }

  @Post()
  create(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.schedules.create(
      actor,
      parseInput(createMedicationScheduleSchema, body),
    );
  }

  @Patch(':id')
  update(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: object,
  ) {
    return this.schedules.update(
      actor,
      parseInput(updateMedicationScheduleSchema, { ...body, id }),
    );
  }

  @Delete(':id')
  remove(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.schedules.remove(actor, parseInput(byIdSchema, { id }));
  }
}
