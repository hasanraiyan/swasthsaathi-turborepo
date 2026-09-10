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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  byIdSchema,
  createMeasurementSchema,
  getMeasurementTrendSchema,
  listMeasurementsSchema,
  updateMeasurementSchema,
} from '@repo/contracts';
import type { Actor } from '@repo/contracts';

import { CurrentActor } from '../../auth/actor.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { parseInput } from '../../common/validation';
import { MeasurementsService } from './measurements.service';

@ApiTags('Measurements')
@ApiBearerAuth('clerk-jwt')
@UseGuards(ClerkAuthGuard)
@Controller('measurements')
export class MeasurementsController {
  constructor(private readonly measurements: MeasurementsService) {}

  // Declared before `:id` would be, so "trend" is never read as an id.
  @ApiOperation({
    summary: 'Get Measurement Trend',
    description: 'Calculates historical averages, trends, min, max, and data series for a specific vital metric (e.g. blood_pressure, blood_sugar, weight, spo2, heart_rate).',
  })
  @ApiQuery({ name: 'type', required: true, enum: ['blood_pressure', 'blood_sugar', 'heart_rate', 'weight', 'spo2', 'temperature'], description: 'Measurement metric' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of past days to analyze (default 30)', example: 30 })
  @ApiResponse({ status: 200, description: 'Measurement trend data' })
  @Get('trend')
  trend(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.measurements.trend(
      actor,
      parseInput(getMeasurementTrendSchema, query),
    );
  }

  @ApiOperation({
    summary: 'List Measurements',
    description: 'Lists vital measurement entries, filterable by type and date range.',
  })
  @ApiResponse({ status: 200, description: 'List of measurements' })
  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.measurements.list(
      actor,
      parseInput(listMeasurementsSchema, query),
    );
  }

  @ApiOperation({
    summary: 'Record Measurement',
    description: 'Logs a new vital sign measurement (e.g. systolic/diastolic BP, fasting blood glucose, pulse, weight in kg).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['type', 'values'],
      properties: {
        type: { type: 'string', enum: ['blood_pressure', 'blood_sugar', 'heart_rate', 'weight', 'spo2', 'temperature'], example: 'blood_pressure' },
        values: {
          type: 'object',
          example: { systolic: 120, diastolic: 80 },
        },
        unit: { type: 'string', example: 'mmHg' },
        recordedAt: { type: 'string', example: '2026-09-10T08:00:00.000Z' },
        context: { type: 'string', example: 'resting, before breakfast' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Measurement recorded' })
  @Post()
  record(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.measurements.record(
      actor,
      parseInput(createMeasurementSchema, body),
    );
  }

  @ApiOperation({
    summary: 'Update Measurement',
    description: 'Corrects an existing measurement entry.',
  })
  @ApiParam({ name: 'id', description: 'Measurement ID' })
  @ApiResponse({ status: 200, description: 'Measurement updated' })
  @Patch(':id')
  update(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: object,
  ) {
    return this.measurements.update(
      actor,
      parseInput(updateMeasurementSchema, { ...body, id }),
    );
  }

  @ApiOperation({
    summary: 'Delete Measurement',
    description: 'Removes a vital measurement record.',
  })
  @ApiParam({ name: 'id', description: 'Measurement ID' })
  @ApiResponse({ status: 200, description: 'Measurement deleted' })
  @Delete(':id')
  remove(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.measurements.remove(actor, parseInput(byIdSchema, { id }));
  }
}
