import type { HttpClient } from '../http';

export interface PersonaThread {
  _id: string;
  domain: string;
  agentId: string;
  subjectType: string;
  externalUserId: string;
  threadId: string;
  title: string;
  isArchived: boolean;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonaVoiceSessionResponse {
  wsUrl: string;
  sessionId?: string;
  expiresAt?: string;
}

export interface PersonaHealthResponse {
  status: string;
  version: string;
  capabilities: Record<string, boolean>;
}

export class PersonaThreadsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists active and past conversation threads for the authenticated user.
   */
  list(): Promise<{ items: PersonaThread[]; total: number } | PersonaThread[]> {
    return this.http.get('/persona/threads');
  }

  /**
   * Creates a new conversation thread with SwasthSaathi.
   */
  create(agentId = '6a82eda2b3d55db9792762cf'): Promise<PersonaThread> {
    return this.http.post<PersonaThread>('/persona/threads', { agentId });
  }

  /**
   * Retrieves a specific conversation thread.
   */
  get(id: string): Promise<PersonaThread> {
    return this.http.get<PersonaThread>(`/persona/threads/${encodeURIComponent(id)}`);
  }

  /**
   * Deletes a conversation thread.
   */
  delete(id: string): Promise<void> {
    return this.http.del<void>(`/persona/threads/${encodeURIComponent(id)}`);
  }

  /**
   * Retrieves message history for a specific thread.
   */
  getMessages(id: string): Promise<unknown[]> {
    return this.http.get<unknown[]>(`/persona/threads/${encodeURIComponent(id)}/messages`);
  }
}

export class PersonaVoiceResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Mints a short-lived ticket and WebSocket URL for a real-time voice session with SwasthSaathi.
   */
  createSession(options: {
    agentId?: string;
    threadId?: string;
  } = {}): Promise<PersonaVoiceSessionResponse> {
    return this.http.post<PersonaVoiceSessionResponse>('/persona/voice/sessions', {
      agentId: options.agentId ?? '6a82eda2b3d55db9792762cf',
      threadId: options.threadId,
    });
  }
}

export class PersonaResource {
  readonly threads: PersonaThreadsResource;
  readonly voice: PersonaVoiceResource;

  constructor(private readonly http: HttpClient) {
    this.threads = new PersonaThreadsResource(http);
    this.voice = new PersonaVoiceResource(http);
  }

  /**
   * Checks runtime health and capabilities of the Persona integration.
   */
  health(): Promise<PersonaHealthResponse> {
    return this.http.get<PersonaHealthResponse>('/persona/health');
  }
}
