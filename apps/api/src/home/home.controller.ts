import { BadRequestException, Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { z } from 'zod';
import { optionalUserId } from '../taste/taste.service.js';
import { USER_HEADER } from '../taste/taste.controller.js';
import { HomeService } from './home.service.js';
import { MAX_INTENT_TEXT } from './route-intent.js';
import { RouteIntentService } from './route-intent.service.js';
import { StoryService } from './story.service.js';

const routeSchema = z.object({ text: z.string().trim().min(1).max(MAX_INTENT_TEXT * 2) });
const homeSchema = z.object({
  client: z
    .object({
      timeZone: z.string().max(64).optional(),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
    })
    .optional(),
});

function parse<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) throw new BadRequestException(z.prettifyError(result.error));
  return result.data;
}

/** La main «Hoy para ti» y el panel «Tu historia». */
@Controller()
export class HomeController {
  constructor(
    private readonly home: HomeService,
    private readonly routes: RouteIntentService,
    private readonly story: StoryService,
  ) {}

  /** A qué temática lleva lo que se escribe en la barra. El texto es un dato: no se guarda. */
  @Post('route-intent')
  route(@Body() body: unknown, @Headers(USER_HEADER) user?: string) {
    const { text } = parse(routeSchema, body);
    return this.routes.route(text, optionalUserId(user));
  }

  /** Contexto, combo de esta noche y actividad por temática. */
  @Post('home')
  summary(@Body() body: unknown, @Headers(USER_HEADER) user?: string) {
    const { client } = parse(homeSchema, body);
    return this.home.summary(optionalUserId(user), client ?? {});
  }

  /** «Tu historia»: solo los datos de esta persona anónima. */
  @Get('story')
  async mine(@Headers(USER_HEADER) user?: string) {
    const userId = optionalUserId(user);
    if (!userId) throw new BadRequestException('Falta la cabecera de persona');
    return this.story.story(userId);
  }
}
