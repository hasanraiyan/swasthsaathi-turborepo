import type { HttpClient } from '../http';

export interface CapabilityDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export class CapabilitiesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Introspects the capability catalog as JSON Schema tool definitions.
   */
  list(): Promise<{ capabilities: CapabilityDefinition[] }> {
    return this.http.get<{ capabilities: CapabilityDefinition[] }>('/capabilities');
  }

  /**
   * Directly invokes a named capability with schema-validated arguments.
   */
  invoke<T = unknown>(name: string, parameters: unknown): Promise<{ result: T }> {
    return this.http.post<{ result: T }>(
      `/capabilities/${encodeURIComponent(name)}/invoke`,
      parameters,
    );
  }
}
