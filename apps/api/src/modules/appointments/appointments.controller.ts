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
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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

@ApiTags('Appointments')
@ApiBearerAuth('clerk-jwt')
@UseGuards(ClerkAuthGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @ApiOperation({
    summary: 'List Appointments',
    description: 'Returns scheduled and past doctor consultations and clinical visits.',
  })
  @ApiResponse({ status: 200, description: 'List of appointments' })
  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.appointments.list(
      actor,
      parseInput(listAppointmentsSchema, query),
    );
  }

  @ApiOperation({
    summary: 'Get Appointment by ID',
    description: 'Returns full appointment details including doctor, location, and notes.',
  })
  @ApiParam({ name: 'id', description: 'Appointment ID' })
  @ApiResponse({ status: 200, description: 'Appointment details' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.appointments.get(actor, parseInput(byIdSchema, { id }));
  }

  @ApiOperation({
    summary: 'Book / Add Appointment',
    description: 'Records a new upcoming medical consultation.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['doctorName', 'scheduledAt'],
      properties: {
        doctorName: { type: 'string', example: 'Dr. Aditi Verma' },
        specialty: { type: 'string', example: 'Cardiology' },
        scheduledAt: { type: 'string', example: '2026-09-15T10:30:00.000Z' },
        location: { type: 'string', example: 'Apollo Hospital, New Delhi' },
        reason: { type: 'string', example: 'Quarterly cardiac review' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Appointment created' })
  @Post()
  create(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.appointments.create(
      actor,
      parseInput(createAppointmentSchema, body),
    );
  }

  @ApiOperation({
    summary: 'Update Appointment',
    description: 'Reschedules or updates details of an existing appointment.',
  })
  @ApiParam({ name: 'id', description: 'Appointment ID' })
  @ApiResponse({ status: 200, description: 'Appointment updated' })
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

  @ApiOperation({
    summary: 'Delete Appointment',
    description: 'Deletes an appointment from the schedule.',
  })
  @ApiParam({ name: 'id', description: 'Appointment ID' })
  @ApiResponse({ status: 200, description: 'Appointment removed' })
  @Delete(':id')
  remove(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.appointments.remove(actor, parseInput(byIdSchema, { id }));
  }
}
