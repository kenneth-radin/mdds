import { AnyZodObject, ZodEffects } from 'zod';
import { Request, Response, NextFunction } from 'express';

type AnySchema = AnyZodObject | ZodEffects<AnyZodObject>;

function parse(schema: AnySchema, value: unknown, source: 'body' | 'query' | 'params') {
  const result = schema.safeParse(value);
  if (!result.success) {
    const error = new Error('Validation failed.');
    (error as Error & { status?: number; details?: unknown }).status = 422;
    (error as Error & { details?: unknown }).details = result.error.issues;
    throw error;
  }
  return result.data as Record<string, unknown>;
}

export function validateBody(schema: AnySchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = parse(schema, req.body, 'body');
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateQuery(schema: AnySchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.query = parse(schema, req.query, 'query') as typeof req.query;
      next();
    } catch (error) {
      next(error);
    }
  };
}
