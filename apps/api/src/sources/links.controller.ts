import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { LinksService } from './links.service.js';

const querySchema = z.union([
  z.object({ session: z.uuid() }),
  z.object({ domain: z.string().regex(/^[a-z]{2,20}$/), entity: z.string().trim().min(2).max(80) }),
]);

/**
 * "Para saber más": enlaces verificados sobre una entidad.
 *  - `GET /api/links?domain=games&entity=Nintendo` (la ficha de un elemento).
 *  - `GET /api/links?session=<id>` (el resultado: lo concreto que pidió en esa entrevista).
 */
@Controller('links')
export class LinksController {
  constructor(private readonly links: LinksService) {}

  @Get()
  get(@Query() query: unknown) {
    const parsed = querySchema.safeParse(query ?? {});
    if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
    const q = parsed.data;
    return 'session' in q ? this.links.forSession(q.session) : this.links.forEntity(q.domain, q.entity);
  }
}
