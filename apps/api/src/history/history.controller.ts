import { BadRequestException, Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { USER_HEADER } from '../taste/taste.controller.js';
import { requireUserId } from '../taste/taste.service.js';
import { HistoryService } from './history.service.js';

/**
 * Importar historial como «ya visto»: el CSV llega como `text/csv` (hasta 5 MB, ver
 * `body-limit.ts`) y Steam como JSON `{ steam: "URL del perfil o SteamID" }`.
 */
@Controller('history')
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  @Get(':domainId')
  latest(@Param('domainId') domainId: string, @Headers(USER_HEADER) user?: string) {
    return this.history.latest(requireUserId(user), domainId).then((view) => ({ import: view }));
  }

  @Post(':domainId')
  start(@Param('domainId') domainId: string, @Body() body: unknown, @Headers(USER_HEADER) user?: string) {
    const userId = requireUserId(user);
    if (typeof body === 'string') return this.history.start(userId, domainId, { csv: body });
    const steam = (body as { steam?: unknown } | undefined)?.steam;
    if (typeof steam === 'string' && steam.length <= 200) return this.history.start(userId, domainId, { steam });
    throw new BadRequestException('Sube un CSV (text/csv) o indica tu perfil de Steam');
  }

  @Post('step/:id')
  step(@Param('id', ParseUUIDPipe) id: string, @Headers(USER_HEADER) user?: string) {
    return this.history.step(requireUserId(user), id);
  }
}
