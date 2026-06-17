import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Centralized exception mapping → a consistent error envelope:
 *   { statusCode, code, message, fieldErrors?, requestId }
 * Never leaks stack traces, raw provider payloads, or secrets to clients.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = req.requestId ?? 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong.';
    let fieldErrors: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
        code = httpCode(status);
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        code = (b.code as string) ?? httpCode(status);
        message = normalizeMessage(b.message) ?? message;
        fieldErrors = (b.fieldErrors as Record<string, string[]>) ?? validationFieldErrors(b.message);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = 'UNIQUE_CONSTRAINT';
        message = 'A record with these values already exists.';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = 'NOT_FOUND';
        message = 'The requested record was not found.';
      } else {
        code = 'DB_ERROR';
      }
    }

    if (status >= 500) {
      this.logger.error(`[${requestId}] ${req.method} ${req.url} → ${status} ${code}`, exception instanceof Error ? exception.stack : undefined);
    } else {
      this.logger.warn(`[${requestId}] ${req.method} ${req.url} → ${status} ${code}`);
    }

    res.status(status).json({ statusCode: status, code, message, fieldErrors, requestId });
  }
}

function httpCode(status: number): string {
  return HttpStatus[status] ?? 'ERROR';
}

function normalizeMessage(message: unknown): string | undefined {
  if (typeof message === 'string') return message;
  if (Array.isArray(message) && message.length) return 'Validation failed.';
  return undefined;
}

/** class-validator throws BadRequest with message: string[] — map to field errors best-effort. */
function validationFieldErrors(message: unknown): Record<string, string[]> | undefined {
  if (!Array.isArray(message)) return undefined;
  const fields: Record<string, string[]> = {};
  for (const m of message as string[]) {
    const field = m.split(' ')[0];
    (fields[field] ??= []).push(m);
  }
  return fields;
}
