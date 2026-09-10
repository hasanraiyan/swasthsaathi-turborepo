import type {
  CreateDoctorInput,
  Doctor,
  ListDoctorsInput,
  UpdateDoctorInput,
} from '../contracts';
import type { HttpClient } from '../http';

export class DoctorsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists healthcare providers and consulting physicians.
   */
  list(query?: ListDoctorsInput): Promise<Doctor[]> {
    return this.http.get<Doctor[]>('/doctors', query as Record<string, unknown>);
  }

  /**
   * Retrieves details of a specific physician.
   */
  get(id: string): Promise<Doctor> {
    return this.http.get<Doctor>(`/doctors/${encodeURIComponent(id)}`);
  }

  /**
   * Adds a new doctor to the care team directory.
   */
  create(input: CreateDoctorInput): Promise<Doctor> {
    return this.http.post<Doctor>('/doctors', input);
  }

  /**
   * Updates doctor contact or hospital details.
   */
  update(id: string, input: Omit<UpdateDoctorInput, 'id'>): Promise<Doctor> {
    return this.http.patch<Doctor>(`/doctors/${encodeURIComponent(id)}`, input);
  }

  /**
   * Removes a doctor from the directory.
   */
  delete(id: string): Promise<void> {
    return this.http.del<void>(`/doctors/${encodeURIComponent(id)}`);
  }
}
