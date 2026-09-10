import type {
  CreateMedicationScheduleInput,
  ListMedicationSchedulesInput,
  MedicationSchedule,
  UpdateMedicationScheduleInput,
} from '../contracts';
import type { HttpClient } from '../http';

export class MedicationSchedulesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Retrieves recurring dose schedules, optionally filtered by medicineId.
   */
  list(query?: ListMedicationSchedulesInput): Promise<MedicationSchedule[]> {
    return this.http.get<MedicationSchedule[]>('/medication-schedules', query as Record<string, unknown>);
  }

  /**
   * Creates a new recurring medication intake schedule.
   */
  create(input: CreateMedicationScheduleInput): Promise<MedicationSchedule> {
    return this.http.post<MedicationSchedule>('/medication-schedules', input);
  }

  /**
   * Updates an existing medication schedule.
   */
  update(
    id: string,
    input: Omit<UpdateMedicationScheduleInput, 'id'>,
  ): Promise<MedicationSchedule> {
    return this.http.patch<MedicationSchedule>(
      `/medication-schedules/${encodeURIComponent(id)}`,
      input,
    );
  }

  /**
   * Deletes a medication schedule.
   */
  delete(id: string): Promise<void> {
    return this.http.del<void>(`/medication-schedules/${encodeURIComponent(id)}`);
  }
}
