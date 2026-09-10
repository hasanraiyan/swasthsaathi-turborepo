export interface ApiIssue {
  path: string;
  message: string;
}

export class SwasthyaApiError extends Error {
  readonly status: number;
  readonly issues: ApiIssue[];
  readonly rawResponse?: unknown;

  constructor(
    status: number,
    message: string,
    issues: ApiIssue[] = [],
    rawResponse?: unknown,
  ) {
    super(message);
    this.name = 'SwasthyaApiError';
    this.status = status;
    this.issues = issues;
    this.rawResponse = rawResponse;
  }

  get userMessage(): string {
    if (this.issues.length > 0) {
      return this.issues.map((i) => i.message).join('\n');
    }
    if (this.status === 0) {
      return 'Could not connect to the Swasthya Saathi API. Please check your internet connection.';
    }
    if (this.status === 401) {
      return 'Authentication required. Please sign in to access your health records.';
    }
    if (this.status === 403) {
      return 'You do not have permission to access this health record.';
    }
    if (this.status === 404) {
      return 'Requested health record was not found.';
    }
    return this.message;
  }
}
