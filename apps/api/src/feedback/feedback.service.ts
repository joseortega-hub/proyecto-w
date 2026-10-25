import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, inArray } from 'drizzle-orm';
import { DB } from '../db/db.module.js';
import type { Db } from '../db/client.js';
import { feedback } from '../db/schema.js';
import type { CreateFeedback, FeedbackStatus } from './feedback.schema.js';

/** Buzón de comentarios: guardar lo que llega de la web, listarlo y marcarlo. */
@Injectable()
export class FeedbackService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(input: CreateFeedback, userId?: string) {
    const [row] = await this.db
      .insert(feedback)
      .values({ ...input, context: input.context ?? {}, userId: userId?.slice(0, 64) || null })
      .returning({ id: feedback.id, createdAt: feedback.createdAt });
    return row;
  }

  /** Sin imágenes (pesan): solo cuántas hay. */
  async list(statuses: FeedbackStatus[]) {
    const rows = await this.db.select().from(feedback).where(inArray(feedback.status, statuses)).orderBy(desc(feedback.createdAt)).limit(200);
    return rows.map(({ images, ...r }) => ({ ...r, imageCount: images.length }));
  }

  async setStatus(id: string, status: FeedbackStatus) {
    const [row] = await this.db.update(feedback).set({ status, updatedAt: new Date() }).where(eq(feedback.id, id)).returning({ id: feedback.id, status: feedback.status });
    return row ?? null;
  }
}
