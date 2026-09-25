import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function notFound(req: Request, res: Response): void {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(422).json({ error: 'Validation failed.', details: err.issues });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  if (err && typeof err === 'object' && 'code' in err && (err as { code?: number }).code === 11000) {
    res.status(409).json({ error: 'A record with that unique value already exists.' });
    return;
  }
  // Middleware-thrown 4xx errors: validate.ts sets `.status` (e.g. 422) and
  // body-parser JSON syntax errors carry `.status = 400`. Honor them instead
  // of misreporting client errors as 500.
  if (err && typeof err === 'object') {
    const candidate = err as { status?: unknown; statusCode?: unknown; details?: unknown };
    const status =
      typeof candidate.status === 'number'
        ? candidate.status
        : typeof candidate.statusCode === 'number'
          ? candidate.statusCode
          : null;
    if (status !== null && status >= 400 && status < 500) {
      const message = err instanceof Error && err.message ? err.message : 'Request failed.';
      res.status(status).json({ error: message, details: candidate.details });
      return;
    }
  }
  const message = err instanceof Error ? err.message : 'Unexpected server error.';
  console.error('[error]', message);
  res.status(500).json({ error: message });
}

export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: T, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
