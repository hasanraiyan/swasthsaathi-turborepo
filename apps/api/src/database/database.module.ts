import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { ReferenceValidator } from './reference-validator';
import { AgentMemory, AgentMemorySchema } from './schemas/agent-memory.schema';
import { ChatMessage, ChatMessageSchema } from './schemas/chat-message.schema';
import { ChatSession, ChatSessionSchema } from './schemas/chat-session.schema';
import { fillDefaultsOnRead } from './schemas/fill-defaults-on-read';
import { Appointment, AppointmentSchema } from './schemas/appointment.schema';
import { Condition, ConditionSchema } from './schemas/condition.schema';
import { Doctor, DoctorSchema } from './schemas/doctor.schema';
import {
  HealthDocument,
  HealthDocumentSchema,
} from './schemas/health-document.schema';
import { Measurement, MeasurementSchema } from './schemas/measurement.schema';
import {
  MedicationDose,
  MedicationDoseSchema,
} from './schemas/medication-dose.schema';
import {
  MedicationSchedule,
  MedicationScheduleSchema,
} from './schemas/medication-schedule.schema';
import { Medicine, MedicineSchema } from './schemas/medicine.schema';
import {
  PreventiveCheckLog,
  PreventiveCheckLogSchema,
} from './schemas/preventive-check-log.schema';
import { Profile, ProfileSchema } from './schemas/profile.schema';
import {
  SymptomEntry,
  SymptomEntrySchema,
} from './schemas/symptom-entry.schema';

// Apply the fill-defaults plugin to every schema while each is still
// individually typed.  The array below widens to a union, so calling
// .plugin() after that loses the concrete generic and TS2349 fires.
ProfileSchema.plugin(fillDefaultsOnRead);
ConditionSchema.plugin(fillDefaultsOnRead);
DoctorSchema.plugin(fillDefaultsOnRead);
MedicineSchema.plugin(fillDefaultsOnRead);
MedicationScheduleSchema.plugin(fillDefaultsOnRead);
MedicationDoseSchema.plugin(fillDefaultsOnRead);
AppointmentSchema.plugin(fillDefaultsOnRead);
SymptomEntrySchema.plugin(fillDefaultsOnRead);
MeasurementSchema.plugin(fillDefaultsOnRead);
HealthDocumentSchema.plugin(fillDefaultsOnRead);
PreventiveCheckLogSchema.plugin(fillDefaultsOnRead);
ChatSessionSchema.plugin(fillDefaultsOnRead);
ChatMessageSchema.plugin(fillDefaultsOnRead);
AgentMemorySchema.plugin(fillDefaultsOnRead);

const registrations = [
  { name: Profile.name, schema: ProfileSchema },
  { name: Condition.name, schema: ConditionSchema },
  { name: Doctor.name, schema: DoctorSchema },
  { name: Medicine.name, schema: MedicineSchema },
  { name: MedicationSchedule.name, schema: MedicationScheduleSchema },
  { name: MedicationDose.name, schema: MedicationDoseSchema },
  { name: Appointment.name, schema: AppointmentSchema },
  { name: SymptomEntry.name, schema: SymptomEntrySchema },
  { name: Measurement.name, schema: MeasurementSchema },
  { name: HealthDocument.name, schema: HealthDocumentSchema },
  { name: PreventiveCheckLog.name, schema: PreventiveCheckLogSchema },
  { name: ChatSession.name, schema: ChatSessionSchema },
  { name: ChatMessage.name, schema: ChatMessageSchema },
  { name: AgentMemory.name, schema: AgentMemorySchema },
];

const models = MongooseModule.forFeature(registrations);

/**
 * The connection to MongoDB and every model in the system.
 *
 * Registering all models here rather than per feature module keeps the
 * cross-collection reads that health data needs (a dose joined to its
 * medicine, a document joined to its doctor) from turning into a web of
 * module imports. Global, so a feature module just injects what it needs.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri = config.get<string>('MONGODB_URI');
        if (!uri) {
          throw new Error(
            'MONGODB_URI is not set. Copy apps/api/.env.example to apps/api/.env and point it at your MongoDB instance.',
          );
        }
        return {
          uri,
          // Fail fast in development rather than buffering queries against a
          // connection that never comes up.
          serverSelectionTimeoutMS: 10_000,
        };
      },
    }),
    models,
  ],
  providers: [ReferenceValidator],
  exports: [models, ReferenceValidator],
})
export class DatabaseModule {}
