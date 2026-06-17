import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

/** Attaches a correlation id to every request (echoed in errors + response header). */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { requestId?: string }, res: Response, next: NextFunction): void {
    const incoming = req.headers['x-request-id'];
    const id = (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID();
    req.requestId = id;
    res.setHeader('x-request-id', id);
    next();
  }
}
