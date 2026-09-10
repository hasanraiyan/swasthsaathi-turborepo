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
  createMedicationScheduleSchema,
  listMedicationSchedulesSchema,
  updateMedicationScheduleSchema,
} from '@repo/contracts';
import type { Actor } from '@repo/contracts';

import { CurrentActor } from '../../auth/actor.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { parseInput } from '../../common/validation';
import { MedicationSchedulesService } from './medication-schedules.service';

@ApiTags('Medication Schedules')
@ApiBearerAuth('clerk-jwt')
@UseGuards(ClerkAuthGuard)
@Controller('medication-schedules')
export class MedicationSchedulesController {
  constructor(private readonly schedules: MedicationSchedulesService) {}

  @ApiOperation({
    summary: 'List Medication Schedules',
    description: 'Returns all recurring dosage schedules for the user medicines.',
  })
  @ApiResponse({ status: 200, description: 'List of schedules' })
  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.schedules.list(
      actor,
      parseInput(listMedicationSchedulesSchema, query),
    );
  }

  @ApiOperation({
    summary: 'Create Medication Schedule',
    description: 'Sets up a recurring schedule with specific intake times (e.g. 08:00, 20:00) and food instructions.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['medicineId', 'times'],
      properties: {
        medicineId: { type: 'string' },
        times: { type: 'array', items: { type: 'string' }, example: ['08:00', '20:00'] },
        daysOfWeek: { type: 'array', items: { type: 'number' }, example: [1, 2, 3, 4, 5, 6, 7] },
        doseQuantity: { type: 'number', example: 1 },
        mealRelation: { type: 'string', enum: ['before_meal', 'with_meal', 'after_meal', 'irrelevant'], example: 'after_meal' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Schedule created' })
  @Post()
  create(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.schedules.create(
      actor,
      parseInput(createMedicationScheduleSchema, body),
    );
  }

  @ApiOperation({
    summary: 'Update Medication Schedule',
    description: 'Modifies timings or rules of an existing medication schedule.',
  })
  @ApiParam({ name: 'id', description: 'Schedule ID' })
  @ApiResponse({ status: 200, description: 'Schedule updated' })
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

  @ApiOperation({
    summary: 'Delete Medication Schedule',
    description: 'Removes a dosage schedule.',
  })
  @ApiParam({ name: 'id', description: 'Schedule ID' })
  @ApiResponse({ status: 200, description: 'Schedule deleted' })
  @Delete(':id')
  remove(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.schedules.remove(actor, parseInput(byIdSchema, { id }));
  }
}
