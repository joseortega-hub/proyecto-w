import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { z } from 'zod';
import { USER_HEADER } from '../taste/taste.controller.js';
import { requireUserId } from '../taste/taste.service.js';
import { SeenService } from './seen.service.js';

const markSchema = z.object({ rating: z.enum(['loved', 'liked', 'meh']).nullable().default(null) });

/** «Ya lo vi / leí / jugué / escuché» de la persona anónima en una temática. */
@Controller('seen/:domainId')
export class SeenController {
  constructor(private readonly seen: SeenService) {}

  @Get()
  list(@Param('domainId') domainId: string, @Headers(USER_HEADER) user?: string) {
    return this.seen.list(requireUserId(user), domainId);
  }

  @Put(':itemId')
  mark(@Param('domainId') domainId: string, @Param('itemId', ParseUUIDPipe) itemId: string, @Body() body: unknown, @Headers(USER_HEADER) user?: string) {
    const parsed = markSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
    return this.seen.mark(requireUserId(user), domainId, itemId, parsed.data.rating);
  }

  @Delete(':itemId')
  unmark(@Param('domainId') domainId: string, @Param('itemId', ParseUUIDPipe) itemId: string, @Headers(USER_HEADER) user?: string) {
    return this.seen.unmark(requireUserId(user), domainId, itemId);
  }
}
