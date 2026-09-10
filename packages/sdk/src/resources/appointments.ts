import type {
  Appointment,
  CreateAppointmentInput,
  ListAppointmentsInput,
  UpdateAppointmentInput,
} from '../contracts';
import type { HttpClient } from '../http';

export class AppointmentsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists scheduled and past doctor consultations and visits.
   */
  list(query?: ListAppointmentsInput): Promise<Appointment[]> {
    return this.http.get<Appointment[]>('/appointments', query as Record<string, unknown>);
  }

  /**
   * Retrieves details of a specific appointment.
   */
  get(id: string): Promise<Appointment> {
    return this.http.get<Appointment>(`/appointments/${encodeURIComponent(id)}`);
  }

  /**
   * Schedules a new appointment.
   */
  create(input: CreateAppointmentInput): Promise<Appointment> {
    return this.http.post<Appointment>('/appointments', input);
  }

  /**
   * Reschedules or updates an existing appointment.
   */
  update(
    id: string,
    input: Omit<UpdateAppointmentInput, 'id'>,
  ): Promise<Appointment> {
    return this.http.patch<Appointment>(
      `/appointments/${encodeURIComponent(id)}`,
      input,
    );
  }

  /**
   * Cancels / deletes an appointment from the schedule.
   */
  delete(id: string): Promise<void> {
    return this.http.del<void>(`/appointments/${encodeURIComponent(id)}`);
  }
}
