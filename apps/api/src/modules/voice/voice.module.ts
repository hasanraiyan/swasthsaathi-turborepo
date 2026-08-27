import { Module } from '@nestjs/common';

import { VoiceCallLogController } from './voice-call-log.controller';
import { VoiceCallLogService } from './voice-call-log.service';
import { VoiceCallLimiter } from './voice-call-limiter.service';
import { VoiceCallService } from './voice-call.service';
import { VoiceController } from './voice.controller';
import { VoiceGateway } from './voice.gateway';

/**
 * Real-time voice calling, relayed through this API rather than dialed
 * directly from mobile to Google -- see `VoiceCallService` for why. Imports
 * no other feature module: tools come from the same global capability
 * registry the text agent uses, so this module needs no wiring beyond it.
 */
@Module({
  controllers: [VoiceController, VoiceCallLogController],
  providers: [
    VoiceGateway,
    VoiceCallService,
    VoiceCallLimiter,
    VoiceCallLogService,
  ],
})
export class VoiceModule {}
