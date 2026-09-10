/**
 * The authenticated user context passed to all controller endpoints and services.
 */
export interface Actor {
  userId: string;
  sessionId?: string;
}

/**
 * Standard pagination query parameters.
 */
export interface PaginationInput {
  page?: number;
  limit?: number;
}

/**
 * Standard pagination response envelope.
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
