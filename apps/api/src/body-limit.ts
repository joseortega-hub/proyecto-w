import type { NestExpressApplication } from '@nestjs/platform-express';

/** Cabe la foto de un artista del Modo Perreo (hasta 600 000 caracteres en base64); Express trae 100 kB. */
export const JSON_LIMIT = '1mb';

/** CSV de historial (Letterboxd, Goodreads): se lee en el servidor y no se guarda. */
export const CSV_LIMIT = '5mb';

export function applyBodyLimit(app: NestExpressApplication) {
  app.useBodyParser('json', { limit: JSON_LIMIT });
  app.useBodyParser('text', { limit: CSV_LIMIT, type: ['text/csv', 'text/plain'] });
}
