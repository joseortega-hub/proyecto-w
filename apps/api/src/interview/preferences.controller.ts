import { BadRequestException, Body, Controller, Inject, Param, Put } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { interviewSessions } from '../db/schema.js';
import { DomainsService } from '../domains/domains.service.js';
import { InterviewService } from './interview.service.js';
import { PreferencesService } from './preferences.service.js';

const bodySchema = z.object({ preferences: z.record(z.string(), z.string().max(40)).default({}) });

@Controller('sessions')
export class PreferencesController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly interviews: InterviewService,
    private readonly domains: DomainsService,
    private readonly preferences: PreferencesService,
  ) {}

  /**
   * Guarda las preferencias previas de la entrevista (p. ej. `{ language: 'es' }`). Las que
   * no lleguen se deducen del texto inicial, si lo hay, o quedan en "me da igual".
   */
  @Put(':id/preferences')
  async set(@Param('id') id: string, @Body() body: unknown) {
    const parsed = bodySchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
    const session = await this.interviews.load(id);
    const domain = await this.domains.get(session.domainId);
    const preferences = await this.preferences.resolve(domain, parsed.data.preferences, session.initialText);
    await this.db.update(interviewSessions).set({ preferences }).where(eq(interviewSessions.id, session.id));
    return preferences;
  }
}
