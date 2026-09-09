import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CapabilitiesModule } from './capabilities/capabilities.module';
import { DatabaseModule } from './database/database.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { ConditionsModule } from './modules/conditions/conditions.module';
import { DoctorsModule } from './modules/doctors/doctors.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { MeasurementsModule } from './modules/measurements/measurements.module';
import { MedicinesModule } from './modules/medicines/medicines.module';
import { PreventionModule } from './modules/prevention/prevention.module';
import { ProfileModule } from './modules/profile/profile.module';
import { SymptomsModule } from './modules/symptoms/symptoms.module';
import { PersonaIntegrationModule } from './modules/persona/persona.module';

/**
 * Swasthya Saathi's API.
 *
 * Each feature module owns one part of the health record and exposes it twice:
 * as REST routes for the app, and as capabilities in the registry.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    CapabilitiesModule,
    ProfileModule,
    PreventionModule,
    ConditionsModule,
    DoctorsModule,
    MedicinesModule,
    AppointmentsModule,
    SymptomsModule,
    MeasurementsModule,
    DocumentsModule,
    PersonaIntegrationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
