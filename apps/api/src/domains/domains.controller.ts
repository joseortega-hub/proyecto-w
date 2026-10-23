import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { PreferencesService } from '../interview/preferences.service.js';
import { DomainsService } from './domains.service.js';

const guessSchema = z.object({ text: z.string().trim().min(1).max(500) });

@Controller('domains')
export class DomainsController {
  constructor(
    private readonly domains: DomainsService,
    private readonly preferences: PreferencesService,
  ) {}

  @Get()
  list() {
    return this.domains.list();
  }

  /** Preselecciona las preferencias previas (p. ej. idioma) a partir del texto inicial. No guarda el texto. */
  @Post(':id/preferences/guess')
  async guess(@Param('id') id: string, @Body() body: unknown) {
    const parsed = guessSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
    return this.preferences.guess(await this.domains.get(id), parsed.data.text);
  }
}
