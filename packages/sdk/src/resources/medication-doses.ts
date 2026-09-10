import type {
  AdherenceSummary,
  DaySchedule,
  GetAdherenceInput,
  GetDayScheduleInput,
  ListDosesInput,
  MedicationDose,
  RecordDoseInput,
} from '../contracts';
import type { HttpClient } from '../http';

export class MedicationDosesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Retrieves today's dosage timeline and adherence state for the home dashboard.
   */
  day(query?: GetDayScheduleInput): Promise<DaySchedule> {
    return this.http.get<DaySchedule>('/medication-doses/day', query as Record<string, unknown>);
  }

  /**
   * Retrieves adherence summary analytics across medications for a time period.
   */
  adherence(query?: GetAdherenceInput): Promise<AdherenceSummary> {
    return this.http.get<AdherenceSummary>(
      '/medication-doses/adherence',
      query as Record<string, unknown>,
    );
  }

  /**
   * Lists logged medication doses.
   */
  list(query?: ListDosesInput): Promise<MedicationDose[]> {
    return this.http.get<MedicationDose[]>('/medication-doses', query as Record<string, unknown>);
  }

  /**
   * Records a dose as taken, missed, or skipped.
   */
  record(
    id: string,
    input: Omit<RecordDoseInput, 'doseId'>,
  ): Promise<MedicationDose> {
    return this.http.post<MedicationDose>(
      `/medication-doses/${encodeURIComponent(id)}/record`,
      input,
    );
  }
}
