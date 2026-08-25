import Constants from 'expo-constants';

/**
 * Typed client for the Swasthya Saathi API.
 *
 * Every request carries the Clerk session token, which the API's guard turns
 * back into the `actor` its capabilities take. The client itself knows nothing
 * about health data -- the types come from `@repo/contracts`, so the app and
 * the API can never disagree about a shape without the build failing.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues: Array<{ path: string; message: string }> = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The message worth showing a user, rather than the HTTP one. */
  get userMessage(): string {
    if (this.issues.length > 0) {
      return this.issues.map((issue) => issue.message).join('\n');
    }
    if (this.status === 0) {
      return "Can't reach the server. Check that the API is running.";
    }
    return this.message;
  }
}

/**
 * Where the API lives.
 *
 * `EXPO_PUBLIC_API_URL` wins when set. Otherwise fall back to the machine
 * running Metro on port 3000 -- on a physical device `localhost` would point
 * at the phone, and on an Android emulator it points at the emulator, so
 * deriving the host from the dev server is the only default that works
 * without configuration.
 */
export function resolveBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  return devHost ? `http://${devHost}:3000/api` : 'http://localhost:3000/api';
}

type Query = Record<string, string | number | boolean | undefined | null>;

export interface ApiClient {
  get<T>(path: string, query?: Query): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  del<T>(path: string): Promise<T>;
}

export function createApiClient(getToken: () => Promise<string | null>): ApiClient {
  const baseUrl = resolveBaseUrl();

  async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
    const url = new URL(`${baseUrl}${path}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    const token = await getToken();
    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      // A network failure has no status; surface it as one the UI can explain.
      throw new ApiError(0, 'Network request failed');
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    const payload: unknown = text ? safeParse(text) : null;

    if (!response.ok) {
      const shape = payload as { message?: string; issues?: Array<{ path: string; message: string }> };
      throw new ApiError(
        response.status,
        shape?.message ?? `Request failed (${response.status})`,
        shape?.issues ?? [],
      );
    }

    return payload as T;
  }

  return {
    get: (path, query) => request('GET', path, undefined, query),
    post: (path, body) => request('POST', path, body),
    patch: (path, body) => request('PATCH', path, body),
    del: (path) => request('DELETE', path),
  };
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
