import { Controller, Get, UseGuards } from '@nestjs/common';
import type { VoiceInfo } from '@repo/contracts';

import { ClerkAuthGuard } from '../../auth/clerk-auth.guard';
import { VoiceCallService } from './voice-call.service';

/** What mobile needs to decide whether to show a working call button. */
@UseGuards(ClerkAuthGuard)
@Controller('voice')
export class VoiceController {
  constructor(private readonly calls: VoiceCallService) {}

  @Get()
  info(): VoiceInfo {
    return {
      isConfigured: this.calls.isConfigured,
      model: this.calls.isConfigured ? this.calls.modelName : null,
      callsPerHour: this.calls.callsPerHour,
      maxCallMinutes: this.calls.maxCallMinutes,
    };
  }
}
