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
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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

@ApiTags('Medication Doses')
@ApiBearerAuth('clerk-jwt')
@UseGuards(ClerkAuthGuard)
@Controller('medication-doses')
export class MedicationDosesController {
  constructor(private readonly doses: MedicationDosesService) {}

  /** The home screen's data: what to take today and what's been taken. */
  @ApiOperation({
    summary: 'Get Day Medication Schedule',
    description: "Returns the current day's doses, scheduled intake slots, and taken/missed statuses for the home screen.",
  })
  @ApiQuery({ name: 'date', required: false, description: 'ISO date string (defaults to today)', example: '2026-09-10' })
  @ApiResponse({ status: 200, description: 'Day schedule and doses' })
  @Get('day')
  day(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.doses.day(actor, parseInput(getDayScheduleSchema, query));
  }

  @ApiOperation({
    summary: 'Get Medication Adherence Summary',
    description: 'Calculates overall and per-medicine adherence rates (percentage taken on time) over a specified date range.',
  })
  @ApiQuery({ name: 'from', required: false, description: 'Start date ISO', example: '2026-09-01' })
  @ApiQuery({ name: 'to', required: false, description: 'End date ISO', example: '2026-09-10' })
  @ApiResponse({ status: 200, description: 'Adherence summary' })
  @Get('adherence')
  adherence(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.doses.adherence(actor, parseInput(getAdherenceSchema, query));
  }

  @ApiOperation({
    summary: 'List Recorded Doses',
    description: 'Lists dose logs, filterable by date range or medicine.',
  })
  @ApiResponse({ status: 200, description: 'List of recorded doses' })
  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.doses.list(actor, parseInput(listDosesSchema, query));
  }

  @ApiOperation({
    summary: 'Record Dose Taken / Missed',
    description: 'Marks a specific dose as taken or missed with an optional timestamp note.',
  })
  @ApiParam({ name: 'id', description: 'Dose record ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['taken', 'missed', 'skipped'], example: 'taken' },
        takenAt: { type: 'string', example: '2026-09-10T08:05:00.000Z' },
        note: { type: 'string', example: 'Taken after breakfast' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Recorded dose result' })
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
