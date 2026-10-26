import { BadRequestException, Body, Controller, Delete, Get, Headers, Logger, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { USER_HEADER } from '../taste/taste.controller.js';
import { requireUserId } from '../taste/taste.service.js';
import { YouTubeService } from './youtube.service.js';

/** Cookie que liga el `state` de OAuth al navegador que empezó la conexión. */
const NONCE_COOKIE = 'sintonia_yt_oauth';
const COOKIE_PATH = '/api/youtube';

const playlistSchema = z.object({
  sessionId: z.uuid(),
  privacy: z.enum(['private', 'unlisted', 'public']).default('private'),
});

const importSchema = z.object({ playlistIds: z.array(z.string().regex(/^[\w-]{2,64}$/)).min(1).max(40).optional() });

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

/** Conectar YouTube: OAuth de Google, importación de la música y listas en la cuenta. */
@Controller('youtube')
export class YouTubeController {
  private readonly logger = new Logger('YouTube');

  constructor(private readonly youtube: YouTubeService) {}

  /** Devuelve la URL de Google y deja el nonce del `state` en una cookie HttpOnly. */
  @Post('auth')
  auth(@Headers(USER_HEADER) user: string | undefined, @Res({ passthrough: true }) res: Response) {
    const { url, nonce } = this.youtube.authStart(requireUserId(user));
    res.cookie(NONCE_COOKIE, nonce, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.youtube.webOrigin().startsWith('https:'),
      path: COOKIE_PATH,
      maxAge: 10 * 60_000,
    });
    return { url };
  }

  /** Redirección de Google (llega por el proxy `/api` de la web). Vuelve a "Mi YouTube". */
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const back = (params: Record<string, string>) => res.redirect(`${this.youtube.webOrigin()}/youtube?${new URLSearchParams(params)}`);
    res.clearCookie(NONCE_COOKIE, { path: COOKIE_PATH });
    if (error || !code || !state) return back({ youtube: 'cancelado' });
    try {
      await this.youtube.callback(code, state, readCookie(req, NONCE_COOKIE));
      return back({ youtube: 'conectado' });
    } catch (e) {
      this.logger.warn(`OAuth rechazado: ${(e as Error).message}`);
      return back({ youtube: 'error' });
    }
  }

  @Get('status')
  status(@Headers(USER_HEADER) user?: string) {
    return this.youtube.status(requireUserId(user));
  }

  /**
   * Vuelve a leer la biblioteca: añade lo nuevo y termina lo que quedó pendiente.
   * Con `playlistIds`, solo esas listas.
   */
  @Post('import')
  import(@Body() body: unknown, @Headers(USER_HEADER) user?: string) {
    const parsed = importSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
    return this.youtube.startImport(requireUserId(user), parsed.data.playlistIds);
  }

  /** Listas propias, las más recientes primero, para elegir cuáles importar. */
  @Get('playlists')
  playlists(@Headers(USER_HEADER) user?: string) {
    return this.youtube.playlists(requireUserId(user));
  }

  @Delete()
  disconnect(@Headers(USER_HEADER) user?: string) {
    return this.youtube.disconnect(requireUserId(user));
  }

  /** Crea en la cuenta de YouTube la lista de un resultado (privada por defecto). */
  @Post('playlists')
  playlist(@Body() body: unknown, @Headers(USER_HEADER) user?: string) {
    const parsed = playlistSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
    return this.youtube.savePlaylist(requireUserId(user), parsed.data.sessionId, parsed.data.privacy);
  }
}
