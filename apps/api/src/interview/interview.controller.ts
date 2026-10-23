import { BadRequestException, Body, Controller, Get, MessageEvent, Param, Post, Query, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { z } from 'zod';
import { InterviewService } from './interview.service.js';
import { TuningService } from './tuning.service.js';

const startSchema = z.object({
  domainId: z.string().default('music'),
  /** Punto de partida opcional (texto o voz transcrita). Se trata como dato, nunca como instrucción. */
  initialText: z.string().max(500).optional(),
});
const answerSchema = z.object({ answer: z.enum(['yes', 'no', 'unknown']) });

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

  @Post()
  start(@Body() body: unknown) {
    const { domainId, initialText } = parse(startSchema, body);
    return this.interviews.start(domainId, initialText);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.interviews.get(id);
  }

  @Post(':id/answers')
  answer(@Param('id') id: string, @Body() body: unknown) {
    return this.interviews.answer(id, parse(answerSchema, body).answer);
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
