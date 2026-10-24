import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { optionalUserId, requireUserId, TasteService } from './taste.service.js';

export const USER_HEADER = 'x-sintonia-user';

const saveSchema = z.object({
  likes: z.array(z.string().max(80)).max(40).default([]),
  dislikes: z.array(z.string().max(80)).max(40).default([]),
  preferences: z.record(z.string(), z.string().max(40)).optional(),
});
const feedbackSchema = z.object({ itemId: z.uuid(), value: z.enum(['up', 'down']).nullable() });
const interpretSchema = z.object({ text: z.string().trim().min(1).max(500) });

function parse<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) throw new BadRequestException(z.prettifyError(result.error));
  return result.data;
}

/** Perfil de gustos de la persona anónima en un dominio ("Mis gustos"). */
@Controller('taste/:domainId')
export class TasteController {
  constructor(private readonly taste: TasteService) {}

  @Get()
  get(@Param('domainId') domainId: string, @Headers(USER_HEADER) user?: string) {
    return this.taste.get(requireUserId(user), domainId);
  }

  @Put()
  save(@Param('domainId') domainId: string, @Body() body: unknown, @Headers(USER_HEADER) user?: string) {
    return this.taste.save(requireUserId(user), domainId, parse(saveSchema, body));
  }

  @Delete()
  remove(@Param('domainId') domainId: string, @Headers(USER_HEADER) user?: string) {
    return this.taste.remove(requireUserId(user), domainId);
  }

  @Post('feedback')
  feedback(@Param('domainId') domainId: string, @Body() body: unknown, @Headers(USER_HEADER) user?: string) {
    const { itemId, value } = parse(feedbackSchema, body);
    return this.taste.feedback(requireUserId(user), domainId, itemId, value);
  }

  /** Texto libre → gustos del vocabulario. No guarda nada (ni el texto). */
  @Post('interpret')
  interpret(@Param('domainId') domainId: string, @Body() body: unknown, @Headers(USER_HEADER) user?: string) {
    return this.taste.interpret(domainId, parse(interpretSchema, body).text, optionalUserId(user));
  }
}
