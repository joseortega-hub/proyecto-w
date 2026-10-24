import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { PreferencesService } from '../interview/preferences.service.js';
import { DomainsService } from './domains.service.js';
import { USER_HEADER } from '../taste/taste.controller.js';
import { optionalUserId } from '../taste/taste.service.js';

const guessSchema = z.object({ text: z.string().trim().min(1).max(500) });

@Controller('domains')
export class DomainsController {
  constructor(
    private readonly domains: DomainsService,
    private readonly preferences: PreferencesService,
  ) {}

  @Get()
  /** Con `?hidden=1` incluye las temáticas secretas: las pide la web y solo las enseña a quien las desbloqueó. */
  list(@Headers(USER_HEADER) user?: string, @Query('hidden') hidden?: string) {
    return this.domains.list(optionalUserId(user), hidden === '1');
  }

  /** Preselecciona las preferencias previas (p. ej. idioma) a partir del texto inicial. No guarda el texto. */
  @Post(':id/preferences/guess')
  async guess(@Param('id') id: string, @Body() body: unknown) {
    const parsed = guessSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
    return this.preferences.guess(await this.domains.get(id), parsed.data.text);
  }
}
