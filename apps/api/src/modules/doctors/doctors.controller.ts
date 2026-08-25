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
  createDoctorSchema,
  listDoctorsSchema,
  updateDoctorSchema,
} from '@repo/contracts';
import type { Actor } from '@repo/contracts';

import { CurrentActor } from '../../auth/actor.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { parseInput } from '../../common/validation';
import { DoctorsService } from './doctors.service';

@UseGuards(ClerkAuthGuard)
@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctors: DoctorsService) {}

  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.doctors.list(actor, parseInput(listDoctorsSchema, query));
  }

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.doctors.get(actor, parseInput(byIdSchema, { id }));
  }

  @Post()
  create(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.doctors.create(actor, parseInput(createDoctorSchema, body));
  }

  @Patch(':id')
  update(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: object,
  ) {
    return this.doctors.update(
      actor,
      parseInput(updateDoctorSchema, { ...body, id }),
    );
  }

  @Delete(':id')
  remove(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.doctors.remove(actor, parseInput(byIdSchema, { id }));
  }
}
