/**
 * Domain errors, thrown by capability services.
 *
 * Deliberately not `HttpException`: a service must be callable from an HTTP
 * controller, a background job or a future agent tool, and none of those
 * should have to understand status codes. `DomainExceptionFilter` translates
 * these at the HTTP edge.
 */
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The record doesn't exist, or belongs to someone else. */
export class NotFoundError extends DomainError {}

/** The request was well-formed but asks for something the data doesn't allow. */
export class ConflictError extends DomainError {}

/** Input failed schema or business validation. */
export class InvalidInputError extends DomainError {
  constructor(
    message: string,
    readonly issues: Array<{ path: string; message: string }> = [],
  ) {
    super(message);
  }
}
