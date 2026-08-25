import { Controller, Get, UseGuards } from '@nestjs/common';
import type { Actor } from '@repo/contracts';

import { AppService } from './app.service';
import { CurrentActor } from './auth/actor.decorator';
import { ClerkAuthGuard } from './auth/clerk-auth.guard';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @UseGuards(ClerkAuthGuard)
  @Get('me')
  getMe(@CurrentActor() actor: Actor): Actor {
    return actor;
  }
}
