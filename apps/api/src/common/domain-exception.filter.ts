import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import {
  ConflictError,
  DomainError,
  InvalidInputError,
  NotFoundError,
} from './errors';

/**
 * Translates domain errors into HTTP responses at the edge, so services can
 * stay transport-agnostic. An agent calling the same service catches the
 * `DomainError` subclass directly and never sees a status code.
 */
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter<DomainError> {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(error: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = statusFor(error);

    if (status >= 500) {
      this.logger.error(error.message, error.stack);
    }

    response.status(status).json({
      statusCode: status,
      error: error.name,
      message: error.message,
      ...(error instanceof InvalidInputError && error.issues.length > 0
        ? { issues: error.issues }
        : {}),
    });
  }
}

function statusFor(error: DomainError): number {
  if (error instanceof NotFoundError) {
    return HttpStatus.NOT_FOUND;
  }
  if (error instanceof InvalidInputError) {
    return HttpStatus.BAD_REQUEST;
  }
  if (error instanceof ConflictError) {
    return HttpStatus.CONFLICT;
  }
  return HttpStatus.INTERNAL_SERVER_ERROR;
}
