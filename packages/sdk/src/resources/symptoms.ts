import type {
  CreateSymptomEntryInput,
  ListSymptomEntriesInput,
  SymptomEntry,
  UpdateSymptomEntryInput,
} from '../contracts';
import type { HttpClient } from '../http';

export class SymptomsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists logged symptom episodes.
   */
  list(query?: ListSymptomEntriesInput): Promise<SymptomEntry[]> {
    return this.http.get<SymptomEntry[]>('/symptoms', query as Record<string, unknown>);
  }

  /**
   * Retrieves details of a specific symptom log.
   */
  get(id: string): Promise<SymptomEntry> {
    return this.http.get<SymptomEntry>(`/symptoms/${encodeURIComponent(id)}`);
  }

  /**
   * Logs a new symptom episode with severity and triggers.
   */
  log(input: CreateSymptomEntryInput): Promise<SymptomEntry> {
    return this.http.post<SymptomEntry>('/symptoms', input);
  }

  /**
   * Updates an ongoing symptom entry.
   */
  update(
    id: string,
    input: Omit<UpdateSymptomEntryInput, 'id'>,
  ): Promise<SymptomEntry> {
    return this.http.patch<SymptomEntry>(
      `/symptoms/${encodeURIComponent(id)}`,
      input,
    );
  }

  /**
   * Deletes a symptom log entry.
   */
  delete(id: string): Promise<void> {
    return this.http.del<void>(`/symptoms/${encodeURIComponent(id)}`);
  }
}
