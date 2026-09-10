import type { Actor } from './contracts';
import { HttpClient, type HttpClientConfig } from './http';
import { AppointmentsResource } from './resources/appointments';
import { CapabilitiesResource } from './resources/capabilities';
import { ConditionsResource } from './resources/conditions';
import { DoctorsResource } from './resources/doctors';
import { DocumentsResource } from './resources/documents';
import { MeasurementsResource } from './resources/measurements';
import { MedicationDosesResource } from './resources/medication-doses';
import { MedicationSchedulesResource } from './resources/medication-schedules';
import { MedicinesResource } from './resources/medicines';
import { PersonaResource } from './resources/persona';
import { PreventionResource } from './resources/prevention';
import { ProfileResource } from './resources/profile';
import { SymptomsResource } from './resources/symptoms';

export interface SwasthyaClientOptions extends HttpClientConfig {}

export class SwasthyaClient {
  readonly http: HttpClient;
  readonly profile: ProfileResource;
  readonly medicines: MedicinesResource;
  readonly medicationSchedules: MedicationSchedulesResource;
  readonly medicationDoses: MedicationDosesResource;
  readonly appointments: AppointmentsResource;
  readonly conditions: ConditionsResource;
  readonly doctors: DoctorsResource;
  readonly documents: DocumentsResource;
  readonly measurements: MeasurementsResource;
  readonly prevention: PreventionResource;
  readonly symptoms: SymptomsResource;
  readonly capabilities: CapabilitiesResource;
  readonly persona: PersonaResource;

  constructor(options: SwasthyaClientOptions) {
    this.http = new HttpClient(options);
    this.profile = new ProfileResource(this.http);
    this.medicines = new MedicinesResource(this.http);
    this.medicationSchedules = new MedicationSchedulesResource(this.http);
    this.medicationDoses = new MedicationDosesResource(this.http);
    this.appointments = new AppointmentsResource(this.http);
    this.conditions = new ConditionsResource(this.http);
    this.doctors = new DoctorsResource(this.http);
    this.documents = new DocumentsResource(this.http);
    this.measurements = new MeasurementsResource(this.http);
    this.prevention = new PreventionResource(this.http);
    this.symptoms = new SymptomsResource(this.http);
    this.capabilities = new CapabilitiesResource(this.http);
    this.persona = new PersonaResource(this.http);
  }

  /**
   * Health check / welcome endpoint.
   */
  getHello(): Promise<string> {
    return this.http.get<string>('/');
  }

  /**
   * Returns authenticated actor identity from the active Clerk token.
   */
  getMe(): Promise<Actor> {
    return this.http.get<Actor>('/me');
  }
}

/**
 * Factory function to create a new SwasthyaClient instance.
 */
export function createSwasthyaClient(options: SwasthyaClientOptions): SwasthyaClient {
  return new SwasthyaClient(options);
}
