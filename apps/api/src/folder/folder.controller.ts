import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { USER_HEADER } from '../taste/taste.controller.js';
import { requireUserId } from '../taste/taste.service.js';
import { audioSchema } from './folder.audio.js';
import { FolderService } from './folder.service.js';

const text = (max: number) => z.string().trim().min(1).max(max);
const addSchema = z.object({
  tracks: z
    .array(
      z.object({
        key: text(300),
        fileName: text(300),
        title: z.string().trim().max(300).nullish(),
        artist: z.string().trim().max(300).nullish(),
        durationSec: z.number().int().min(0).max(36_000).nullish(),
      }),
    )
    .min(1)
    .max(12),
});
const correctSchema = z.object({ title: text(300), artist: z.string().trim().max(300).nullish() });

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
  return parsed.data;
}

/** "Mi carpeta": recibe solo los datos de los archivos locales (nunca el audio). */
@Controller('folder')
export class FolderController {
  constructor(private readonly folder: FolderService) {}

  @Get('status')
  status(@Headers(USER_HEADER) user?: string) {
    return this.folder.status(requireUserId(user));
  }

  @Get('keys')
  keys(@Headers(USER_HEADER) user?: string) {
    return this.folder.keys(requireUserId(user));
  }

  @Get('tracks')
  tracks(@Headers(USER_HEADER) user?: string) {
    return this.folder.list(requireUserId(user));
  }

  @Post('tracks')
  add(@Body() body: unknown, @Headers(USER_HEADER) user?: string) {
    return this.folder.addTracks(requireUserId(user), parse(addSchema, body).tracks);
  }

  @Patch('tracks/:id')
  correct(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @Headers(USER_HEADER) user?: string) {
    const { title, artist } = parse(correctSchema, body);
    return this.folder.correct(requireUserId(user), id, { title, artist: artist || null });
  }

  /** Termina atributos y embeddings pendientes; la web lo repite mientras quede algo. */
  @Post('resume')
  resume(@Headers(USER_HEADER) user?: string) {
    return this.folder.resume(requireUserId(user));
  }

  /** Archivos aún sin medir en el dispositivo. */
  @Get('audio/pending')
  audioPending(@Headers(USER_HEADER) user?: string) {
    return this.folder.audioPending(requireUserId(user));
  }

  /** Medición del audio hecha en el navegador (Essentia.js): solo números, nunca el audio. */
  @Post('audio')
  audio(@Body() body: unknown, @Headers(USER_HEADER) user?: string) {
    return this.folder.saveAudio(requireUserId(user), parse(audioSchema, body).measurements);
  }

  @Delete()
  remove(@Headers(USER_HEADER) user?: string) {
    return this.folder.remove(requireUserId(user));
  }
}
