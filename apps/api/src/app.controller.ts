import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Actor } from '@repo/contracts';

import { AppService } from './app.service';
import { CurrentActor } from './auth/actor.decorator';
import { ClerkAuthGuard } from './auth/clerk-auth.guard';

@ApiTags('System')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({
    summary: 'API Health / Welcome Check',
    description: 'Returns a simple greeting indicating the Swasthya Saathi API is running.',
  })
  @ApiResponse({ status: 200, description: 'API is healthy and online' })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @ApiBearerAuth('clerk-jwt')
  @ApiOperation({
    summary: 'Get Current Authenticated Actor',
    description: 'Returns the authenticated user details extracted from the Clerk session token.',
  })
  @ApiResponse({ status: 200, description: 'Authenticated actor identity' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Clerk Bearer token' })
  @UseGuards(ClerkAuthGuard)
  @Get('me')
  getMe(@CurrentActor() actor: Actor): Actor {
    return actor;
  }
}
