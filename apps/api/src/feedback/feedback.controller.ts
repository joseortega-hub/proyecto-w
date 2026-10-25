import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { config } from '../config.js';
import { USER_HEADER } from '../taste/taste.controller.js';
import { createFeedbackSchema, FEEDBACK_STATUSES, statusSchema, type FeedbackStatus } from './feedback.schema.js';
import { FeedbackService } from './feedback.service.js';

const KEY_HEADER = 'x-feedback-key';

/** Leer y marcar el buzón exige FEEDBACK_ADMIN_KEY; sin ella configurada, solo se lee con `pnpm feedback`. */
function assertAdmin(key?: string) {
  const expected = config.feedbackAdminKey;
  const ok = !!expected && !!key && key.length === expected.length && timingSafeEqual(Buffer.from(key), Buffer.from(expected));
  if (!ok) throw new ForbiddenException('Sin acceso al buzón');
}

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  /** Cualquiera puede escribir al buzón desde la web. */
  @Post()
  async create(@Body() body: unknown, @Headers(USER_HEADER) user?: string) {
    const parsed = createFeedbackSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
    return this.feedback.create(parsed.data, user);
  }

  @Get()
  list(@Headers(KEY_HEADER) key?: string, @Query('status') status?: string) {
    assertAdmin(key);
    const statuses = (status ? status.split(',') : ['new', 'read']).filter((s): s is FeedbackStatus => (FEEDBACK_STATUSES as readonly string[]).includes(s));
    return this.feedback.list(statuses.length ? statuses : ['new', 'read']);
  }

  @Patch(':id')
  async setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @Headers(KEY_HEADER) key?: string) {
    assertAdmin(key);
    const parsed = statusSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
    const row = await this.feedback.setStatus(id, parsed.data.status);
    if (!row) throw new NotFoundException('No existe ese comentario');
    return row;
  }
}
