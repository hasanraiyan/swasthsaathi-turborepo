import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { updateProfileSchema } from '@repo/contracts';
import type { Actor, Profile } from '@repo/contracts';

import { CurrentActor } from '../../auth/actor.decorator';
import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { parseInput } from '../../common/validation';
import { ProfileService } from './profile.service';

@UseGuards(ClerkAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  get(@CurrentActor() actor: Actor): Promise<Profile> {
    return this.profile.get(actor);
  }

  @Patch()
  update(
    @CurrentActor() actor: Actor,
    @Body() body: unknown,
  ): Promise<Profile> {
    return this.profile.update(actor, parseInput(updateProfileSchema, body));
  }
}
