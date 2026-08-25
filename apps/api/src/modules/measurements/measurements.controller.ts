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

@UseGuards(ClerkAuthGuard)
@Controller('measurements')
export class MeasurementsController {
  constructor(private readonly measurements: MeasurementsService) {}

  // Declared before `:id` would be, so "trend" is never read as an id.
  @Get('trend')
  trend(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.measurements.trend(
      actor,
      parseInput(getMeasurementTrendSchema, query),
    );
  }

  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.measurements.list(
      actor,
      parseInput(listMeasurementsSchema, query),
    );
  }

  @Post()
  record(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.measurements.record(
      actor,
      parseInput(createMeasurementSchema, body),
    );
  }

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

  @Delete(':id')
  remove(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.measurements.remove(actor, parseInput(byIdSchema, { id }));
  }
}
