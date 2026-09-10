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
  createSymptomEntrySchema,
  listSymptomEntriesSchema,
  updateSymptomEntrySchema,
} from '@repo/contracts';
import type { Actor } from '@repo/contracts';

import { CurrentActor } from '../../auth/actor.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { parseInput } from '../../common/validation';
import { SymptomsService } from './symptoms.service';

@ApiTags('Symptoms')
@ApiBearerAuth('clerk-jwt')
@UseGuards(ClerkAuthGuard)
@Controller('symptoms')
export class SymptomsController {
  constructor(private readonly symptoms: SymptomsService) {}

  @ApiOperation({
    summary: 'List Symptom Logs',
    description: 'Returns historical symptom entries, severity records, and onset dates.',
  })
  @ApiResponse({ status: 200, description: 'List of symptoms' })
  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.symptoms.list(
      actor,
      parseInput(listSymptomEntriesSchema, query),
    );
  }

  @ApiOperation({
    summary: 'Get Symptom by ID',
    description: 'Retrieves symptom log details including severity (1-10) and notes.',
  })
  @ApiParam({ name: 'id', description: 'Symptom record ID' })
  @ApiResponse({ status: 200, description: 'Symptom details' })
  @ApiResponse({ status: 404, description: 'Symptom not found' })
  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.symptoms.get(actor, parseInput(byIdSchema, { id }));
  }

  @ApiOperation({
    summary: 'Log Symptom',
    description: 'Records a newly observed symptom with severity, triggers, and duration.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['symptom', 'severity'],
      properties: {
        symptom: { type: 'string', example: 'Migraine headache' },
        severity: { type: 'number', minimum: 1, maximum: 10, example: 6 },
        startedAt: { type: 'string', example: '2026-09-10T06:30:00.000Z' },
        notes: { type: 'string', example: 'Sensitivity to light' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Symptom logged' })
  @Post()
  log(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.symptoms.log(actor, parseInput(createSymptomEntrySchema, body));
  }

  @ApiOperation({
    summary: 'Update Symptom Entry',
    description: 'Updates severity or notes on an ongoing symptom.',
  })
  @ApiParam({ name: 'id', description: 'Symptom record ID' })
  @ApiResponse({ status: 200, description: 'Symptom updated' })
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

  @ApiOperation({
    summary: 'Delete Symptom Entry',
    description: 'Removes a logged symptom entry.',
  })
  @ApiParam({ name: 'id', description: 'Symptom record ID' })
  @ApiResponse({ status: 200, description: 'Symptom deleted' })
  @Delete(':id')
  remove(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.symptoms.remove(actor, parseInput(byIdSchema, { id }));
  }
}
