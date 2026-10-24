import { BadRequestException, Body, Controller, Get, Headers, MessageEvent, Param, Post, Query, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { z } from 'zod';
import { InterviewService } from './interview.service.js';
import { TuningService } from './tuning.service.js';
import { USER_HEADER } from '../taste/taste.controller.js';
import { optionalUserId } from '../taste/taste.service.js';

const anchorSchema = z.object({
  label: z.string().min(1).max(60),
  kind: z.enum(['franchise', 'creator', 'studio', 'title', 'tag']),
  terms: z.array(z.string().max(60)).max(10),
  required: z.boolean(),
});
/** Lo entendido del texto, ya corregido por la persona en la tarjeta. */
const understandingSchema = z.object({
  moods: z.array(z.object({ key: z.string().max(40), level: z.enum(['low', 'high']) })).max(12),
  anchors: z.array(anchorSchema).max(3),
  preferences: z.record(z.string(), z.string().max(40)),
  exclusions: z.array(z.string().max(40)).max(10),
});
const understandSchema = z.object({
  domainId: z.string().default('music'),
  text: z.string().min(1).max(500),
});

const startSchema = z.object({
  domainId: z.string().default('music'),
  /** Punto de partida opcional (texto o voz transcrita). Se trata como dato, nunca como instrucción. */
  initialText: z.string().max(500).optional(),
  /** Preferencias elegidas con los botones (`{ language: 'es' }`): ganan a las deducidas del texto. */
  preferences: z.record(z.string(), z.string().max(40)).optional(),
  /** Gustos guardados desactivados solo para esta entrevista. */
  tasteOff: z.array(z.string().max(80)).max(60).optional(),
  /** Lo entendido del texto ya corregido; si falta, se entiende en el servidor. */
  understanding: understandingSchema.optional(),
  /** Contexto del navegador: zona horaria y, si ya dio permiso, posición aproximada. */
  client: z
    .object({
      timeZone: z.string().max(64).optional(),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
    })
    .optional(),
});
const answerSchema = z.object({
  answer: z.enum(['yes', 'no', 'unknown']),
  /** Número de la pregunta que se responde: protege contra dobles envíos. */
  step: z.number().int().positive().optional(),
});

function parse<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) throw new BadRequestException(z.prettifyError(result.error));
  return result.data;
}

@Controller('sessions')
export class InterviewController {
  constructor(
    private readonly interviews: InterviewService,
    private readonly tuning: TuningService,
  ) {}

  /** "Esto es lo que he entendido": ánimo, anclas, preferencias y exclusiones del texto, sin crear la sesión ni guardar el texto. */
  @Post('understand')
  understand(@Body() body: unknown, @Headers(USER_HEADER) user?: string) {
    const { domainId, text } = parse(understandSchema, body);
    return this.interviews.understand(domainId, text, optionalUserId(user));
  }

  @Post()
  start(@Body() body: unknown, @Headers(USER_HEADER) user?: string) {
    const { domainId, initialText, client, preferences, tasteOff, understanding } = parse(startSchema, body);
    return this.interviews.start(domainId, { initialText, client, preferences, tasteOff, understanding, userId: optionalUserId(user) });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.interviews.get(id);
  }

  @Post(':id/answers')
  answer(@Param('id') id: string, @Body() body: unknown) {
    const { answer, step } = parse(answerSchema, body);
    return this.interviews.answer(id, answer, step);
  }

  /** Responde la pregunta pendiente a partir del texto inicial (clientes sin pantalla, como el MCP). */
  @Post(':id/auto-answer')
  autoAnswer(@Param('id') id: string) {
    return this.interviews.autoAnswer(id);
  }

  @Post(':id/undo')
  undo(@Param('id') id: string) {
    return this.interviews.undo(id);
  }

  /** Server-Sent Events con el progreso de Afinando. `?refine=more-energy,with-voice` relanza con ajustes. */
  @Sse(':id/tune')
  tune(@Param('id') id: string, @Query('refine') refine?: string): Observable<MessageEvent> {
    const refinements = refine ? refine.split(',').filter(Boolean) : [];
    return new Observable((subscriber) => {
      let cancelled = false;
      (async () => {
        try {
          for await (const event of this.tuning.run(id, refinements)) {
            if (cancelled) return;
            subscriber.next({ data: event });
          }
        } catch (error) {
          subscriber.next({ data: { step: 'error', message: (error as Error).message } });
        }
        subscriber.complete();
      })();
      return () => {
        cancelled = true;
      };
    });
  }

  @Get(':id/result')
  result(@Param('id') id: string) {
    return this.tuning.result(id);
  }
}
