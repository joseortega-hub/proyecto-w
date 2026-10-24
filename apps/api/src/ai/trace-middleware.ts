import type { NextFunction, Request, Response } from 'express';
import { runInTrace } from './trace-context.js';

const SESSION_PATH = /\/sessions\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/** Marca a qué entrevista pertenecen las llamadas de IA de una petición `/sessions/:id/...`. */
export function traceContextMiddleware(req: Request, _res: Response, next: NextFunction) {
  const sessionId = SESSION_PATH.exec(req.path)?.[1];
  if (sessionId) runInTrace({ sessionId }, next);
  else next();
}
