import type {
  CreateMeasurementInput,
  GetMeasurementTrendInput,
  ListMeasurementsInput,
  Measurement,
  MeasurementTrend,
  UpdateMeasurementInput,
} from '../contracts';
import type { HttpClient } from '../http';

export class MeasurementsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Calculates metric trends, historical averages, min/max, and series over time.
   */
  trend(query: GetMeasurementTrendInput): Promise<MeasurementTrend> {
    return this.http.get<MeasurementTrend>(
      '/measurements/trend',
      query as Record<string, unknown>,
    );
  }

  /**
   * Lists logged vital measurements.
   */
  list(query?: ListMeasurementsInput): Promise<Measurement[]> {
    return this.http.get<Measurement[]>('/measurements', query as Record<string, unknown>);
  }

  /**
   * Logs a new vital measurement (BP, blood sugar, weight, SpO2, heart rate, temperature).
   */
  record(input: CreateMeasurementInput): Promise<Measurement> {
    return this.http.post<Measurement>('/measurements', input);
  }

  /**
   * Updates an existing measurement entry.
   */
  update(
    id: string,
    input: Omit<UpdateMeasurementInput, 'id'>,
  ): Promise<Measurement> {
    return this.http.patch<Measurement>(
      `/measurements/${encodeURIComponent(id)}`,
      input,
    );
  }

  /**
   * Deletes a measurement record.
   */
  delete(id: string): Promise<void> {
    return this.http.del<void>(`/measurements/${encodeURIComponent(id)}`);
  }
}
