import { HttpException, HttpStatus } from '@nestjs/common';

/** Field-level validation errors, keyed by field name. */
export type FieldErrors = Record<string, string[]>;

/**
 * Domain errors carry a stable machine code plus an HTTP status, so the API can
 * return a consistent { statusCode, code, message, fieldErrors } envelope.
 */
export class DomainError extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
    readonly fieldErrors?: FieldErrors,
  ) {
    super({ code, message, fieldErrors }, status);
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id?: string) {
    super('NOT_FOUND', `${entity}${id ? ` ${id}` : ''} not found.`, HttpStatus.NOT_FOUND);
  }
}

export class ConflictError extends DomainError {
  constructor(code: string, message: string, fieldErrors?: FieldErrors) {
    super(code, message, HttpStatus.CONFLICT, fieldErrors);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'You do not have permission to perform this action.') {
    super('FORBIDDEN', message, HttpStatus.FORBIDDEN);
  }
}

/** Active leads require an owner, a next action, and a next-action date. */
export class LeadNextActionRequiredError extends DomainError {
  constructor(missing: FieldErrors) {
    super(
      'LEAD_NEXT_ACTION_REQUIRED',
      'Active leads require an owner, next action, and next-action date.',
      HttpStatus.UNPROCESSABLE_ENTITY,
      missing,
    );
  }
}
