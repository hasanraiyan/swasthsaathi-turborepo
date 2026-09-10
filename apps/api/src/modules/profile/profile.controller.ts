import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { updateProfileSchema } from '@repo/contracts';
import type { Actor, Profile } from '@repo/contracts';

import { CurrentActor } from '../../auth/actor.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { parseInput } from '../../common/validation';
import { ProfileService } from './profile.service';

@ApiTags('Profile')
@ApiBearerAuth('clerk-jwt')
@UseGuards(ClerkAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @ApiOperation({
    summary: 'Get User Profile',
    description: 'Returns the personal health profile, demographics, blood group, emergency contacts, and baseline info for the authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'User health profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get()
  get(@CurrentActor() actor: Actor): Promise<Profile> {
    return this.profile.get(actor);
  }

  @ApiOperation({
    summary: 'Update User Profile',
    description: 'Updates personal profile attributes such as full name, date of birth, blood group, phone, emergency contacts, or baseline health notes.',
  })
  @ApiBody({
    description: 'Profile update fields',
    schema: {
      type: 'object',
      properties: {
        fullName: { type: 'string', example: 'Raiyan Hasan' },
        dateOfBirth: { type: 'string', example: '2000-01-15' },
        gender: { type: 'string', enum: ['male', 'female', 'other', 'prefer_not_to_say'], example: 'male' },
        bloodGroup: { type: 'string', enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], example: 'O+' },
        phone: { type: 'string', example: '+919876543210' },
        emergencyContact: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'Guardian Name' },
            relationship: { type: 'string', example: 'Parent' },
            phone: { type: 'string', example: '+919876543211' },
          },
        },
        allergies: { type: 'array', items: { type: 'string' }, example: ['Penicillin', 'Peanuts'] },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Updated profile' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @Patch()
  update(
    @CurrentActor() actor: Actor,
    @Body() body: unknown,
  ): Promise<Profile> {
    return this.profile.update(actor, parseInput(updateProfileSchema, body));
  }
}
