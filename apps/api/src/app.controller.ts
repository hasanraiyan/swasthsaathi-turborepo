import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { ClerkAuthGuard } from './auth/clerk-auth.guard';
import { CurrentUser } from './auth/current-user.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @UseGuards(ClerkAuthGuard)
  @Get('me')
  getMe(@CurrentUser() auth: { userId: string; sessionId: string }) {
    return auth;
  }
}
