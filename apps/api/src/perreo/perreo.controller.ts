import { BadRequestException, Body, Controller, Get, Header, Param, Post, Query, StreamableFile } from '@nestjs/common';
import { PerreoService } from './perreo.service.js';
import type { ArtistSort } from './perreo.filters.js';

const num = (v?: string) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? undefined : Number(v));
const text = (v?: string) => (v ? v.slice(0, 80) : undefined);

@Controller('perreo')
export class PerreoController {
  constructor(private readonly perreo: PerreoService) {}

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

  @Get('artists/:slug')
  get(@Param('slug') slug: string) {
    return this.perreo.get(slug.slice(0, 80));
  }

  @Get('artists/:slug/photo')
  @Header('Cache-Control', 'public, max-age=86400')
  async photo(@Param('slug') slug: string) {
    return new StreamableFile(await this.perreo.photo(slug.slice(0, 80)), { type: 'image/webp' });
  }
}
