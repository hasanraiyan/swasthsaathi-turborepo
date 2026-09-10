import type {
  CompleteCheckInput,
  HealthSnapshot,
  ListCheckHistoryInput,
  PreventiveCheckLog,
  PreventivePlan,
} from '../contracts';
import type { HttpClient } from '../http';

export class PreventionResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Retrieves an overview snapshot of preventive screenings and vaccines.
   */
  snapshot(): Promise<HealthSnapshot> {
    return this.http.get<HealthSnapshot>('/prevention/snapshot');
  }

  /**
   * Retrieves the personalized preventive care schedule.
   */
  plan(): Promise<PreventivePlan> {
    return this.http.get<PreventivePlan>('/prevention/plan');
  }

  /**
   * Lists past completion records of preventive checks and tests.
   */
  history(query?: ListCheckHistoryInput): Promise<PreventiveCheckLog[]> {
    return this.http.get<PreventiveCheckLog[]>(
      '/prevention/history',
      query as Record<string, unknown>,
    );
  }

  /**
   * Marks a preventive health check as completed.
   */
  complete(input: CompleteCheckInput): Promise<PreventiveCheckLog> {
    return this.http.post<PreventiveCheckLog>('/prevention/complete', input);
  }
}
