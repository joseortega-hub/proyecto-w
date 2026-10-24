import { Controller, Get, Headers, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { DomainsService } from '../domains/domains.service.js';
import { ItemsService } from './items.service.js';
import { USER_HEADER } from '../taste/taste.controller.js';
import { optionalUserId } from '../taste/taste.service.js';

@Controller()
export class ItemsController {
  constructor(
    private readonly items: ItemsService,
    private readonly domains: DomainsService,
  ) {}

  /** Biblioteca del dominio: `?q=texto&tags=a,b&offset=0&limit=24` (máximo 60). */
  @Get('domains/:domainId/items')
  async browse(
    @Param('domainId') domainId: string,
    @Query('q') q?: string,
    @Query('tags') tags?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
    @Headers(USER_HEADER) user?: string,
  ) {
    await this.domains.get(domainId);
    return this.items.browse(domainId, {
      q: q?.slice(0, 80),
      tags: tags?.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 20),
      offset: Math.max(0, Number(offset) || 0),
      limit: Math.min(60, Math.max(1, Number(limit) || 24)),
      userId: optionalUserId(user),
    });
  }

  @Get('items/:id')
  get(@Param('id', ParseUUIDPipe) id: string, @Headers(USER_HEADER) user?: string) {
    return this.items.get(id, optionalUserId(user));
  }

  /** Elementos parecidos por embedding (`?limit=10`, máximo 30). */
  @Get('items/:id/similar')
  similar(@Param('id', ParseUUIDPipe) id: string, @Query('limit') limit?: string, @Headers(USER_HEADER) user?: string) {
    return this.items.similar(id, Math.min(30, Math.max(1, Number(limit) || 10)), optionalUserId(user));
  }
}
