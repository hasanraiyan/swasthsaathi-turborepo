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
  createConditionSchema,
  listConditionsSchema,
  updateConditionSchema,
} from '@repo/contracts';
import type { Actor } from '@repo/contracts';

import { CurrentActor } from '../../auth/actor.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { parseInput } from '../../common/validation';
import { ConditionsService } from './conditions.service';

@ApiTags('Conditions')
@ApiBearerAuth('clerk-jwt')
@UseGuards(ClerkAuthGuard)
@Controller('conditions')
export class ConditionsController {
  constructor(private readonly conditions: ConditionsService) {}

  @ApiOperation({
    summary: 'List Conditions',
    description: 'Lists all diagnosed health conditions and chronic illness records.',
  })
  @ApiResponse({ status: 200, description: 'List of conditions' })
  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.conditions.list(actor, parseInput(listConditionsSchema, query));
  }

  @ApiOperation({
    summary: 'Get Condition by ID',
    description: 'Retrieves condition details, diagnosis date, and current status.',
  })
  @ApiParam({ name: 'id', description: 'Condition ID' })
  @ApiResponse({ status: 200, description: 'Condition details' })
  @ApiResponse({ status: 404, description: 'Condition not found' })
  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.conditions.get(actor, parseInput(byIdSchema, { id }));
  }

  @ApiOperation({
    summary: 'Create Health Condition',
    description: 'Adds a diagnosed condition (e.g. Type 2 Diabetes, Hypertension) to the record.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', example: 'Hypertension' },
        status: { type: 'string', enum: ['active', 'managed', 'resolved'], example: 'active' },
        diagnosedDate: { type: 'string', example: '2024-05-10' },
        notes: { type: 'string', example: 'Stage 1, monitoring BP daily' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Condition created' })
  @Post()
  create(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.conditions.create(
      actor,
      parseInput(createConditionSchema, body),
    );
  }

  @ApiOperation({
    summary: 'Update Condition',
    description: 'Updates condition status, treatment notes, or severity.',
  })
  @ApiParam({ name: 'id', description: 'Condition ID' })
  @ApiResponse({ status: 200, description: 'Condition updated' })
  @Patch(':id')
  update(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: object,
  ) {
    return this.conditions.update(
      actor,
      parseInput(updateConditionSchema, { ...body, id }),
    );
  }

  @ApiOperation({
    summary: 'Delete Condition',
    description: 'Removes a condition record.',
  })
  @ApiParam({ name: 'id', description: 'Condition ID' })
  @ApiResponse({ status: 200, description: 'Condition removed' })
  @Delete(':id')
  remove(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.conditions.remove(actor, parseInput(byIdSchema, { id }));
  }
}
