import type { Profile, UpdateProfileInput } from '../contracts';
import type { HttpClient } from '../http';

export class ProfileResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Retrieves the current user's personal health profile, demographics,
   * emergency contacts, blood group, and baseline history.
   */
  get(): Promise<Profile> {
    return this.http.get<Profile>('/profile');
  }

  /**
   * Updates fields on the user's personal health profile.
   */
  update(input: UpdateProfileInput): Promise<Profile> {
    return this.http.patch<Profile>('/profile', input);
  }
}
