import { SwasthyaApiError } from './errors';

export interface HttpClientConfig {
  baseUrl: string;
  getAuthToken?: () => Promise<string | null | undefined> | string | null | undefined;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}

export type QueryParams = Record<string, unknown>;

export class HttpClient {
  private readonly baseUrl: string;
  private readonly getAuthToken?: () => Promise<string | null | undefined> | string | null | undefined;
  private readonly defaultHeaders: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.getAuthToken = config.getAuthToken;
    this.defaultHeaders = config.headers ?? {};
    this.fetchImpl = config.fetch ?? globalThis.fetch;
  }

  private buildUrl(path: string, query?: QueryParams): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${cleanPath}`);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item !== undefined && item !== null) {
              url.searchParams.append(key, String(item));
            }
          }
        } else {
          url.searchParams.append(key, String(value));
        }
      }
    }

    return url.toString();
  }

  private async buildHeaders(customHeaders?: Record<string, string>): Promise<Headers> {
    const headers = new Headers({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...this.defaultHeaders,
      ...customHeaders,
    });

    if (this.getAuthToken) {
      const token = await this.getAuthToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    return headers;
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    options: {
      query?: QueryParams;
      body?: unknown;
      headers?: Record<string, string>;
      signal?: AbortSignal;
    } = {},
  ): Promise<T> {
    const url = this.buildUrl(path, options.query);
    const headers = await this.buildHeaders(options.headers);

    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: options.signal,
      });
    } catch (err) {
      throw new SwasthyaApiError(0, err instanceof Error ? err.message : 'Network request failed');
    }

    if (res.status === 204) {
      return undefined as T;
    }

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (!res.ok) {
      let message = `API request failed with status ${res.status}`;
      let issues: Array<{ path: string; message: string }> = [];
      let rawResponse: unknown;

      if (isJson) {
        try {
          const errorJson = await res.json();
          rawResponse = errorJson;
          if (typeof errorJson === 'object' && errorJson !== null) {
            const errObj = errorJson as Record<string, unknown>;
            message = (errObj.message as string) || (errObj.error as string) || message;
            if (Array.isArray(errObj.issues)) {
              issues = errObj.issues as Array<{ path: string; message: string }>;
            }
          }
        } catch {
          // fallback to text
        }
      } else {
        try {
          message = (await res.text()) || message;
        } catch {
          // ignore
        }
      }

      throw new SwasthyaApiError(res.status, message, issues, rawResponse);
    }

    if (isJson) {
      return (await res.json()) as T;
    }

    return (await res.text()) as unknown as T;
  }

  get<T>(path: string, query?: QueryParams, signal?: AbortSignal): Promise<T> {
    return this.request<T>('GET', path, { query, signal });
  }

  post<T>(path: string, body?: unknown, query?: QueryParams, signal?: AbortSignal): Promise<T> {
    return this.request<T>('POST', path, { body, query, signal });
  }

  patch<T>(path: string, body?: unknown, query?: QueryParams, signal?: AbortSignal): Promise<T> {
    return this.request<T>('PATCH', path, { body, query, signal });
  }

  del<T = void>(path: string, query?: QueryParams, signal?: AbortSignal): Promise<T> {
    return this.request<T>('DELETE', path, { query, signal });
  }
}
