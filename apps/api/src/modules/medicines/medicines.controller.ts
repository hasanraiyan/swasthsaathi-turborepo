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

@UseGuards(ClerkAuthGuard)
@Controller('medicines')
export class MedicinesController {
  constructor(private readonly medicines: MedicinesService) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.medicines.list(actor, parseInput(listMedicinesSchema, query));
  }

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.medicines.get(actor, parseInput(byIdSchema, { id }));
  }

  @Post()
  create(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.medicines.create(actor, parseInput(createMedicineSchema, body));
  }

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

  @Delete(':id')
  remove(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.medicines.remove(actor, parseInput(byIdSchema, { id }));
  }
}
