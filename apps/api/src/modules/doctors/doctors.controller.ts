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
  createDoctorSchema,
  listDoctorsSchema,
  updateDoctorSchema,
} from '@repo/contracts';
import type { Actor } from '@repo/contracts';

import { CurrentActor } from '../../auth/actor.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { parseInput } from '../../common/validation';
import { DoctorsService } from './doctors.service';

@ApiTags('Doctors')
@ApiBearerAuth('clerk-jwt')
@UseGuards(ClerkAuthGuard)
@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctors: DoctorsService) {}

  @ApiOperation({
    summary: 'List Doctors',
    description: 'Lists all doctors, consultants, and specialists associated with the user care team.',
  })
  @ApiResponse({ status: 200, description: 'List of doctors' })
  @Get()
  list(@CurrentActor() actor: Actor, @Query() query: unknown) {
    return this.doctors.list(actor, parseInput(listDoctorsSchema, query));
  }

  @ApiOperation({
    summary: 'Get Doctor by ID',
    description: 'Retrieves doctor details, contact information, hospital affiliation, and clinic hours.',
  })
  @ApiParam({ name: 'id', description: 'Doctor ID' })
  @ApiResponse({ status: 200, description: 'Doctor details' })
  @ApiResponse({ status: 404, description: 'Doctor not found' })
  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.doctors.get(actor, parseInput(byIdSchema, { id }));
  }

  @ApiOperation({
    summary: 'Add Doctor',
    description: 'Adds a new healthcare provider or specialist to the user care network.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', example: 'Dr. Rajesh Gupta' },
        specialty: { type: 'string', example: 'Endocrinologist' },
        clinicName: { type: 'string', example: 'Max Healthcare' },
        phone: { type: 'string', example: '+919811122334' },
        email: { type: 'string', example: 'dr.rajesh@example.com' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Doctor added' })
  @Post()
  create(@CurrentActor() actor: Actor, @Body() body: unknown) {
    return this.doctors.create(actor, parseInput(createDoctorSchema, body));
  }

  @ApiOperation({
    summary: 'Update Doctor',
    description: 'Updates doctor contact information or clinic details.',
  })
  @ApiParam({ name: 'id', description: 'Doctor ID' })
  @ApiResponse({ status: 200, description: 'Doctor updated' })
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

  @ApiOperation({
    summary: 'Delete Doctor',
    description: 'Removes a doctor from the care team.',
  })
  @ApiParam({ name: 'id', description: 'Doctor ID' })
  @ApiResponse({ status: 200, description: 'Doctor removed' })
  @Delete(':id')
  remove(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.doctors.remove(actor, parseInput(byIdSchema, { id }));
  }
}
