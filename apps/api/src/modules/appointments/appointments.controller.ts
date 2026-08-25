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
  createAppointmentSchema,
  listAppointmentsSchema,
  updateAppointmentSchema,
} from '@repo/contracts';
import type { Actor } from '@repo/contracts';

import { CurrentActor } from '../../auth/actor.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { parseInput } from '../../common/validation';
import { AppointmentsService } from './appointments.service';

@UseGuards(ClerkAuthGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.appointments.list(
      actor,
      parseInput(listAppointmentsSchema, query),
    );
  }

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.appointments.get(actor, parseInput(byIdSchema, { id }));
  }

  @Post()
  create(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.appointments.create(
      actor,
      parseInput(createAppointmentSchema, body),
    );
  }

  @Patch(':id')
  update(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: object,
  ) {
    return this.appointments.update(
      actor,
      parseInput(updateAppointmentSchema, { ...body, id }),
    );
  }

  @Delete(':id')
  remove(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.appointments.remove(actor, parseInput(byIdSchema, { id }));
  }
}
