import { Module } from '@nestjs/common';

import { ProfileModule } from '../profile/profile.module';
import { PreventionController } from './prevention.controller';
import { PreventionService } from './prevention.service';

/**
 * Preventive care. Imports the profile module because the plan is a function
 * of the health baseline, which the profile owns.
 */
@Module({
  imports: [ProfileModule],
  controllers: [PreventionController],
  providers: [PreventionService],
  exports: [PreventionService],
})
export class PreventionModule {}
