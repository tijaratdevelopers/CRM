import { NextFunction, Request, Response } from 'express';
import { HttpError } from './auth';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error(err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  return res.status(500).json({ error: message });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'Route not found' });
}
