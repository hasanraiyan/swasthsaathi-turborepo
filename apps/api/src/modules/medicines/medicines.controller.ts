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
  createMedicineSchema,
  listMedicinesSchema,
  stopMedicineSchema,
  updateMedicineSchema,
} from '@repo/contracts';
import type { Actor } from '@repo/contracts';

import { CurrentActor } from '../../auth/actor.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { parseInput } from '../../common/validation';
import { MedicinesService } from './medicines.service';

@ApiTags('Medicines')
@ApiBearerAuth('clerk-jwt')
@UseGuards(ClerkAuthGuard)
@Controller('medicines')
export class MedicinesController {
  constructor(private readonly medicines: MedicinesService) {}

  @ApiOperation({
    summary: 'List Medicines',
    description: 'Retrieves all medicines for the authenticated user, optionally filtered by status (active or stopped).',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'stopped', 'all'], description: 'Filter medicines by status' })
  @ApiResponse({ status: 200, description: 'List of medicines' })
  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.medicines.list(actor, parseInput(listMedicinesSchema, query));
  }

  @ApiOperation({
    summary: 'Get Medicine by ID',
    description: 'Retrieves full details of a specific medicine course including dosage, frequency, prescribing doctor, and instructions.',
  })
  @ApiParam({ name: 'id', description: 'Medicine record ID' })
  @ApiResponse({ status: 200, description: 'Medicine details' })
  @ApiResponse({ status: 404, description: 'Medicine not found' })
  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.medicines.get(actor, parseInput(byIdSchema, { id }));
  }

  @ApiOperation({
    summary: 'Create New Medicine',
    description: 'Adds a new prescribed or OTC medicine course to the health record.',
  })
  @ApiBody({
    description: 'Medicine details',
    schema: {
      type: 'object',
      required: ['name', 'dosage'],
      properties: {
        name: { type: 'string', example: 'Metformin' },
        dosage: { type: 'string', example: '500mg' },
        form: { type: 'string', enum: ['tablet', 'capsule', 'syrup', 'injection', 'inhaler', 'drops', 'ointment'], example: 'tablet' },
        frequency: { type: 'string', example: 'Twice daily after meals' },
        instructions: { type: 'string', example: 'Take with full glass of water' },
        startDate: { type: 'string', example: '2026-09-01' },
        prescribedBy: { type: 'string', example: 'Dr. Sharma' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Medicine created' })
  @Post()
  create(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.medicines.create(actor, parseInput(createMedicineSchema, body));
  }

  @ApiOperation({
    summary: 'Update Medicine',
    description: 'Updates details of an existing medicine course.',
  })
  @ApiParam({ name: 'id', description: 'Medicine record ID' })
  @ApiResponse({ status: 200, description: 'Medicine updated' })
  @Patch(':id')
  update(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: object,
  ) {
    return this.medicines.update(
      actor,
      parseInput(updateMedicineSchema, { ...body, id }),
    );
  }

  /** End a course but keep its history. The everyday alternative to delete. */
  @ApiOperation({
    summary: 'Stop Medicine Course',
    description: 'Marks a medicine course as stopped (completed or discontinued) with an optional reason, preserving treatment history.',
  })
  @ApiParam({ name: 'id', description: 'Medicine record ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', example: 'Course completed' },
        stoppedAt: { type: 'string', example: '2026-09-10' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Medicine stopped' })
  @Post(':id/stop')
  stop(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: object,
  ) {
    return this.medicines.stop(
      actor,
      parseInput(stopMedicineSchema, { ...body, id }),
    );
  }

  @ApiOperation({
    summary: 'Delete Medicine',
    description: 'Permanently removes a medicine record from the database.',
  })
  @ApiParam({ name: 'id', description: 'Medicine record ID' })
  @ApiResponse({ status: 200, description: 'Medicine deleted' })
  @Delete(':id')
  remove(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.medicines.remove(actor, parseInput(byIdSchema, { id }));
  }
}
