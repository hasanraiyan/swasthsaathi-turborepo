import { Module } from '@nestjs/common';

import { MedicationDosesController } from './medication-doses.controller';
import { MedicationDosesService } from './medication-doses.service';
import { MedicationSchedulesController } from './medication-schedules.controller';
import { MedicationSchedulesService } from './medication-schedules.service';
import { MedicinesController } from './medicines.controller';
import { MedicinesService } from './medicines.service';

/**
 * Medicines, their schedules and their dose history.
 *
 * The three live in one module because they are one capability from the
 * user's point of view -- "my medicines" -- and splitting them would mean
 * three modules importing each other to cascade a single stop or delete.
 */
@Module({
  controllers: [
    MedicinesController,
    MedicationSchedulesController,
    MedicationDosesController,
  ],
  providers: [
    MedicinesService,
    MedicationSchedulesService,
    MedicationDosesService,
  ],
  exports: [
    MedicinesService,
    MedicationSchedulesService,
    MedicationDosesService,
  ],
})
export class MedicinesModule {}
