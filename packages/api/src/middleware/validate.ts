import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';
import { badRequest } from '../lib/errors';

export const validateBody =
  (schema: ZodSchema): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(badRequest('Validation failed', result.error.flatten()));
    req.body = result.data;
    next();
  };

export const validateQuery =
  (schema: ZodSchema): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return next(badRequest('Validation failed', result.error.flatten()));
    req.query = result.data as typeof req.query;
    next();
  };
