import type {
  CreateMedicineInput,
  ListMedicinesInput,
  Medicine,
  StopMedicineInput,
  UpdateMedicineInput,
} from '../contracts';
import type { HttpClient } from '../http';

export class MedicinesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Retrieves all medicines for the authenticated user, optionally filtered by status (active or stopped).
   */
  list(query?: ListMedicinesInput): Promise<Medicine[]> {
    return this.http.get<Medicine[]>('/medicines', query as Record<string, unknown>);
  }

  /**
   * Retrieves details of a specific medicine course.
   */
  get(id: string): Promise<Medicine> {
    return this.http.get<Medicine>(`/medicines/${encodeURIComponent(id)}`);
  }

  /**
   * Records a new prescribed or OTC medicine course.
   */
  create(input: CreateMedicineInput): Promise<Medicine> {
    return this.http.post<Medicine>('/medicines', input);
  }

  /**
   * Updates an existing medicine record.
   */
  update(id: string, input: Omit<UpdateMedicineInput, 'id'>): Promise<Medicine> {
    return this.http.patch<Medicine>(`/medicines/${encodeURIComponent(id)}`, input);
  }

  /**
   * Marks a medicine course as stopped (completed or discontinued) while retaining history.
   */
  stop(id: string, input?: Omit<StopMedicineInput, 'id'>): Promise<Medicine> {
    return this.http.post<Medicine>(`/medicines/${encodeURIComponent(id)}/stop`, input ?? {});
  }

  /**
   * Permanently deletes a medicine record.
   */
  delete(id: string): Promise<void> {
    return this.http.del<void>(`/medicines/${encodeURIComponent(id)}`);
  }
}
