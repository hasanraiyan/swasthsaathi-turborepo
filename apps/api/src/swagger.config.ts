import { DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';

export function createSwaggerDocument(app: INestApplication): OpenAPIObject {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Swasthya Saathi API')
    .setDescription(
      `### Swasthya Saathi (स्वास्थ साथी) REST API & Capability Engine
A warm, empathetic AI health companion and personal health record system.

#### Architecture Highlights:
- **Authentication**: All endpoints (except \`GET /api\` and Persona health checks) require a Clerk Bearer JWT token (\`Authorization: Bearer <session_token>\`).
- **Domain Modules**: Structured healthcare entities (Profile, Medicines, Schedules, Doses, Appointments, Conditions, Doctors, Documents, Measurements, Prevention, Symptoms).
- **Persona AI Integration**: Conversational health agent integration with streaming chat (\`/api/persona/chat\`), thread management (\`/api/persona/threads\`), and real-time voice sessions (\`/api/persona/voice/sessions\`).
- **Capability Registry**: Introspect and execute health capabilities as structured function-calling tools (\`/api/capabilities\`).
`,
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your Clerk JWT session token',
        in: 'header',
      },
      'clerk-jwt',
    )
    .addTag('System', 'Health checks and root system endpoints')
    .addTag('Profile', 'Personal profile, demographics, and emergency contacts')
    .addTag('Medicines', 'Prescriptions and medication management')
    .addTag('Medication Schedules', 'Intake timings and dosage schedules')
    .addTag('Medication Doses', 'Daily dose tracking and adherence logging')
    .addTag('Appointments', 'Doctor consultations and follow-up schedules')
    .addTag('Conditions', 'Diagnosed health conditions and status tracking')
    .addTag('Doctors', 'Directory of healthcare providers and specialists')
    .addTag('Documents', 'Medical records, lab reports, and prescriptions')
    .addTag('Measurements', 'Vital sign tracking (BP, blood sugar, weight, SpO2, heart rate)')
    .addTag('Prevention', 'Preventive screenings, vaccinations, and lifestyle goals')
    .addTag('Symptoms', 'Symptom logging and severity monitoring')
    .addTag('Capabilities', 'Agent tools and capability registry execution')
    .build();

  return SwaggerModule.createDocument(app, swaggerConfig);
}
