import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { OpsService } from './ops.service.js';
import { TraceService } from './trace.service.js';

const sessionId = z.string().uuid();

function sessionOf(value: unknown): string {
  const parsed = sessionId.safeParse(value);
  if (!parsed.success) throw new BadRequestException('Falta una sesión válida');
  return parsed.data;
}

/** "Bajo el capó": trazas de IA, comparativa de proveedores y juez. Solo metadatos. */
@Controller('ops')
export class OpsController {
  constructor(
    private readonly ops: OpsService,
    private readonly traces: TraceService,
  ) {}

  /** Línea de tiempo y resumen de una sesión (sin `session`, solo el resumen global). */
  @Get('panel')
  panel(@Query('session') session?: string) {
    return this.ops.panel(session ? sessionOf(session) : null);
  }

  /** Sondeo ligero del modo demo: trazas posteriores a `since`. */
  @Get('traces')
  async since(@Query('session') session: string, @Query('since') since?: string) {
    const date = since ? new Date(since) : undefined;
    return { rows: await this.traces.forSession(sessionOf(session), date && !Number.isNaN(date.getTime()) ? date : undefined) };
  }

  @Post('compare')
  compare(@Body() body: { session?: string }) {
    return this.ops.compare(sessionOf(body?.session));
  }

  @Post('judge')
  judge(@Body() body: { session?: string }) {
    return this.ops.judge(sessionOf(body?.session));
  }
}
