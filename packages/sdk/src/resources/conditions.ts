import type {
  Condition,
  CreateConditionInput,
  ListConditionsInput,
  UpdateConditionInput,
} from '../contracts';
import type { HttpClient } from '../http';

export class ConditionsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists diagnosed conditions and chronic illnesses.
   */
  list(query?: ListConditionsInput): Promise<Condition[]> {
    return this.http.get<Condition[]>('/conditions', query as Record<string, unknown>);
  }

  /**
   * Retrieves details of a specific diagnosed condition.
   */
  get(id: string): Promise<Condition> {
    return this.http.get<Condition>(`/conditions/${encodeURIComponent(id)}`);
  }

  /**
   * Records a new diagnosed health condition.
   */
  create(input: CreateConditionInput): Promise<Condition> {
    return this.http.post<Condition>('/conditions', input);
  }

  /**
   * Updates condition details, management status, or notes.
   */
  update(
    id: string,
    input: Omit<UpdateConditionInput, 'id'>,
  ): Promise<Condition> {
    return this.http.patch<Condition>(
      `/conditions/${encodeURIComponent(id)}`,
      input,
    );
  }

  /**
   * Removes a condition record.
   */
  delete(id: string): Promise<void> {
    return this.http.del<void>(`/conditions/${encodeURIComponent(id)}`);
  }
}
