import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { and, isNotNull, lt, or } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { interviewSessions } from '../db/schema.js';

const MAX_AGE_MS = 24 * 60 * 60_000;
const EVERY_MS = 60 * 60_000;

/**
 * Privacidad: el texto inicial solo vive mientras dura la entrevista (Afinando lo borra
 * al calcular el perfil). Aquí se borra también en las que ya tienen perfil y en las
 * abandonadas (24 h sin cambios).
 */
@Injectable()
export class SessionCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Limpieza');
  private timer?: NodeJS.Timeout;

  constructor(@Inject(DB) private readonly db: Db) {}

  onModuleInit() {
    void this.forgetInitialTexts();
    this.timer = setInterval(() => void this.forgetInitialTexts(), EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async forgetInitialTexts(now = new Date()): Promise<number> {
    try {
      const cleared = await this.db
        .update(interviewSessions)
        .set({ initialText: null })
        .where(
          and(
            isNotNull(interviewSessions.initialText),
            // Abandonadas (24 h sin cambios) o ya con perfil, aunque sea de antes de esta regla.
            or(
              lt(interviewSessions.updatedAt, new Date(now.getTime() - MAX_AGE_MS)),
              isNotNull(interviewSessions.profile),
            ),
          ),
        )
        .returning({ id: interviewSessions.id });
      if (cleared.length) this.logger.log(`Texto inicial borrado de ${cleared.length} entrevistas abandonadas`);
      return cleared.length;
    } catch (error) {
      this.logger.warn(`No he podido limpiar los textos iniciales: ${(error as Error).message}`);
      return 0;
    }
  }
}
