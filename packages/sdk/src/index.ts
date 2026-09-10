// Main Client & Factory
export { SwasthyaClient, createSwasthyaClient } from './client';
export type { SwasthyaClientOptions } from './client';

// HTTP & Errors
export { SwasthyaApiError } from './errors';
export type { ApiIssue } from './errors';
export { HttpClient } from './http';
export type { HttpClientConfig, QueryParams } from './http';

// Resource Classes
export { ProfileResource } from './resources/profile';
export { MedicinesResource } from './resources/medicines';
export { MedicationSchedulesResource } from './resources/medication-schedules';
export { MedicationDosesResource } from './resources/medication-doses';
export { AppointmentsResource } from './resources/appointments';
export { ConditionsResource } from './resources/conditions';
export { DoctorsResource } from './resources/doctors';
export { DocumentsResource } from './resources/documents';
export { MeasurementsResource } from './resources/measurements';
export { PreventionResource } from './resources/prevention';
export { SymptomsResource } from './resources/symptoms';
export { CapabilitiesResource } from './resources/capabilities';
export type { CapabilityDefinition } from './resources/capabilities';
export {
  PersonaResource,
  PersonaThreadsResource,
  PersonaVoiceResource,
} from './resources/persona';
export type {
  PersonaThread,
  PersonaVoiceSessionResponse,
  PersonaHealthResponse,
} from './resources/persona';

// Re-export all domain contracts, schemas, and types
export * from './contracts';
