import { BadRequestException, Body, Controller, ForbiddenException, Get, Header, Headers, Param, Patch, Post, Query, StreamableFile } from '@nestjs/common';
import { DomainsService } from '../domains/domains.service.js';
import { USER_HEADER } from '../taste/taste.controller.js';
import { optionalUserId } from '../taste/taste.service.js';
import { artistPatchSchema } from './perreo.edit.js';
import { PerreoService } from './perreo.service.js';
import { PerreoPulseService } from './perreo.pulse.service.js';
import { PERIODS, RELEASE_PERIODS, type Period, type ReleasePeriod } from './perreo.pulse.js';
import type { ArtistSort } from './perreo.filters.js';

const num = (v?: string) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? undefined : Number(v));
const text = (v?: string) => (v ? v.slice(0, 80) : undefined);

@Controller('perreo')
export class PerreoController {
  constructor(
    private readonly perreo: PerreoService,
    private readonly domains: DomainsService,
    private readonly pulse: PerreoPulseService,
  ) {}

  /** Novedades: `?period=week|month|year|upcoming&kind=album|song&country=` */
  @Get('releases')
  releases(@Query('period') period?: string, @Query('kind') kind?: string, @Query('country') country?: string) {
    const p = RELEASE_PERIODS.includes(period as ReleasePeriod) ? (period as ReleasePeriod) : 'week';
    return this.pulse.releases(p, kind === 'album' || kind === 'song' ? kind : undefined, text(country));
  }

  /** Lo más caliente: `?period=week|month|year&country=` */
  @Get('hot')
  hot(@Query('period') period?: string, @Query('country') country?: string) {
    return this.pulse.hot(PERIODS.includes(period as Period) ? (period as Period) : 'week', text(country));
  }

  /** Cara a cara: `?slugs=a,b,c` (de 2 a 4). */
  @Get('compare')
  compare(@Query('slugs') slugs?: string) {
    const list = [...new Set((slugs ?? '').split(',').map((s) => s.trim().toLowerCase().slice(0, 80)).filter(Boolean))].slice(0, 4);
    if (list.length < 2) throw new BadRequestException('Elige al menos dos artistas');
    return this.pulse.compare(list);
  }

  /** `?sort=fame|age|name&fameMin=0&fameMax=100&country=&city=&era=&label=&style=&q=` */
  @Get('artists')
  list(
    @Query('sort') sort?: string,
    @Query('q') q?: string,
    @Query('fameMin') fameMin?: string,
    @Query('fameMax') fameMax?: string,
    @Query('country') country?: string,
    @Query('city') city?: string,
    @Query('era') era?: string,
    @Query('label') label?: string,
    @Query('style') style?: string,
    @Query('followed') followed?: string,
    @Query('kind') kind?: string,
  ) {
    return this.perreo.list({
      sort: (['fame', 'age', 'name'] as const).includes(sort as ArtistSort) ? (sort as ArtistSort) : 'fame',
      q: text(q),
      fameMin: num(fameMin),
      fameMax: num(fameMax),
      country: text(country),
      city: text(city),
      era: text(era),
      label: text(label),
      style: text(style),
      followed: followed === '1' || followed === 'true',
      kind: text(kind),
    });
  }

  /** Pantalla «Por revisar»: cuentas dudosas de Instagram y las decisiones tomadas. */
  @Get('review')
  review() {
    return this.perreo.pendingReview();
  }

  @Post('review/:id')
  decide(@Param('id') id: string, @Body() body: { decision?: string }) {
    const status = ({ accept: 'accepted', reject: 'rejected', undo: 'pending' } as const)[body?.decision as 'accept'];
    if (!status) throw new BadRequestException('decision: accept, reject o undo');
    return this.perreo.decide(id.slice(0, 80).toLowerCase(), status);
  }

  /** «Mi YouTube» enlazado con los artistas: `{ links: { itemId: [{ slug, name }] }, top }`. Vacío sin desbloquear. */
  @Get('youtube')
  async youtube(@Headers(USER_HEADER) user?: string) {
    const userId = optionalUserId(user);
    if (!userId || !(await this.domains.hasUnlocked(userId))) return { links: {}, top: [] };
    return this.perreo.youtubeLinks(userId);
  }

  /** «En tu YouTube»: las canciones guardadas de la persona en las que sale el artista. */
  @Get('artists/:slug/youtube')
  async artistYoutube(@Param('slug') slug: string, @Headers(USER_HEADER) user?: string) {
    const userId = optionalUserId(user);
    if (!userId || !(await this.domains.hasUnlocked(userId))) return [];
    return this.perreo.youtubeSongs(slug.slice(0, 80).toLowerCase(), userId);
  }

  @Get('artists/:slug')
  get(@Param('slug') slug: string) {
    return this.perreo.get(slug.slice(0, 80));
  }

  /** Edita un artista a mano; solo quien tiene el Modo Perreo desbloqueado. Lo editado no lo pisa ninguna recarga. */
  @Patch('artists/:slug')
  async edit(@Param('slug') slug: string, @Body() body: unknown, @Headers(USER_HEADER) user?: string) {
    if (!(await this.domains.hasUnlocked(optionalUserId(user)))) throw new ForbiddenException('Primero desbloquea el Modo Perreo');
    const parsed = artistPatchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues.map((i) => `${i.path.join('.') || 'cuerpo'}: ${i.message}`).join('; '));
    return this.perreo.edit(slug.slice(0, 80), parsed.data);
  }

  @Get('artists/:slug/photo')
  @Header('Cache-Control', 'public, max-age=86400')
  async photo(@Param('slug') slug: string) {
    return new StreamableFile(await this.perreo.photo(slug.slice(0, 80)), { type: 'image/webp' });
  }
}
