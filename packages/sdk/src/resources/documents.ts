import type {
  CreateDocumentInput,
  HealthDocument,
  ListDocumentsInput,
  UpdateDocumentInput,
} from '../contracts';
import type { HttpClient } from '../http';

export class DocumentsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists medical documents, reports, and prescription scans.
   */
  list(query?: ListDocumentsInput): Promise<HealthDocument[]> {
    return this.http.get<HealthDocument[]>('/documents', query as Record<string, unknown>);
  }

  /**
   * Retrieves details and file URL of a specific document.
   */
  get(id: string): Promise<HealthDocument> {
    return this.http.get<HealthDocument>(`/documents/${encodeURIComponent(id)}`);
  }

  /**
   * Registers a new uploaded document in the medical archive.
   */
  create(input: CreateDocumentInput): Promise<HealthDocument> {
    return this.http.post<HealthDocument>('/documents', input);
  }

  /**
   * Updates document metadata, category, or notes.
   */
  update(
    id: string,
    input: Omit<UpdateDocumentInput, 'id'>,
  ): Promise<HealthDocument> {
    return this.http.patch<HealthDocument>(
      `/documents/${encodeURIComponent(id)}`,
      input,
    );
  }

  /**
   * Removes a document entry.
   */
  delete(id: string): Promise<void> {
    return this.http.del<void>(`/documents/${encodeURIComponent(id)}`);
  }
}
