import { describe, expect, it } from 'vitest';
import { compareHistory, filterReleases, isCollab, yearsActive, growthBetween, inPeriod, normalizeCompare, periodRange, rankHot, type HotInput, type Release, type StatSnapshot } from './perreo.pulse.js';

// Domingo 25/10/2026, víspera de la demo.
const NOW = new Date('2026-10-25T12:00:00Z');

describe('rangos de fechas de novedades', () => {
  it('semana y mes son los últimos 7 y 30 días; el año, desde el 1 de enero; lo próximo, de mañana a un año', () => {
    expect(periodRange('week', NOW)).toEqual({ from: '2026-10-19', to: '2026-10-25' });
    expect(periodRange('month', NOW)).toEqual({ from: '2026-09-26', to: '2026-10-25' });
    expect(periodRange('year', NOW)).toEqual({ from: '2026-01-01', to: '2026-10-25' });
    expect(periodRange('upcoming', NOW)).toEqual({ from: '2026-10-26', to: '2027-10-25' });
  });

  it('un lunes, «la semana» incluye los lanzamientos del viernes', () => {
    expect(inPeriod('2026-10-23', 'week', new Date('2026-10-26T08:00:00Z'))).toBe(true);
  });

  it('entiende fechas incompletas de MusicBrainz', () => {
    expect(inPeriod('2027', 'upcoming', NOW)).toBe(true);
    expect(inPeriod('2026', 'upcoming', NOW)).toBe(false);
    expect(inPeriod('2026-11', 'upcoming', NOW)).toBe(true);
    expect(inPeriod('2026-10', 'month', NOW)).toBe(true);
    expect(inPeriod('2026-10-26', 'week', NOW)).toBe(false);
    expect(inPeriod('', 'year', NOW)).toBe(false);
  });

  it('filtra por tipo, quita duplicados entre fuentes y ordena', () => {
    const r = (id: string, title: string, date: string, kind: 'album' | 'song' = 'song', cover: string | null = null): Release => ({ id, artistSlug: 'feid', kind, recordType: null, title, releaseDate: date, coverUrl: cover, link: null, source: id.split(':')[0], fans: null });
    const rows = [r('mb:1', 'Luna (feat. ATL Jacob)', '2026-10-20'), r('deezer:1', 'Luna', '2026-10-20', 'song', 'https://c'), r('deezer:2', 'Ferxxo 200', '2026-10-24', 'album'), r('deezer:3', 'Vieja', '2025-01-01'), r('mb:2', 'Lo que viene', '2026-12-05'), r('mb:3', 'Antes', '2026-11-02')];
    expect(filterReleases(rows, 'week', undefined, NOW).map((x) => x.id)).toEqual(['deezer:2', 'deezer:1']);
    expect(filterReleases(rows, 'week', 'song', NOW).map((x) => x.id)).toEqual(['deezer:1']);
    expect(filterReleases(rows, 'upcoming', undefined, NOW).map((x) => x.id)).toEqual(['mb:3', 'mb:2']);
  });
});

describe('lo más caliente por país y momento', () => {
  const snap = (dayStr: string, v: number, geo: Record<string, number> = {}): StatSnapshot => ({ day: dayStr, lastfmListeners: v, lastfmPlays: null, deezerFans: v, youtubeViews: null, geo });
  const artist = (slug: string, fame: number, extra: Partial<HotInput> = {}): HotInput => ({ slug, countries: ['Puerto Rico'], fame, stats: [snap('2026-10-25', 1000)], releases: [], ...extra });

  it('el crecimiento compara con la última foto anterior al periodo', () => {
    expect(growthBetween(snap('a', 100), snap('b', 110))).toBeCloseTo(0.1);
    expect(growthBetween({ ...snap('a', 0), deezerFans: null }, snap('b', 5))).toBeNull();
  });

  it('un lanzamiento del momento pesa más que la fama de fondo', () => {
    const list = [artist('famoso', 95), artist('nuevo', 40, { releases: [{ kind: 'album', releaseDate: '2026-10-23' }, { kind: 'song', releaseDate: '2026-10-21' }] })];
    const week = rankHot(list, { period: 'week', now: NOW });
    expect(week[0].slug).toBe('nuevo');
    expect(week[0].reasons).toContain('2 lanzamientos');
    // En el año ya no cuentan los de hace 10 meses de otro artista, pero sí estos.
    expect(rankHot(list, { period: 'year', now: NOW })[0].slug).toBe('nuevo');
  });

  it('por país entran los de allí y los que están en su top de Last.fm, con bonus por puesto', () => {
    const list = [artist('local', 50, { countries: ['España'] }), artist('boricua', 60, { stats: [snap('2026-10-25', 1000, { España: 1 })] }), artist('fuera', 99, { countries: ['Chile'] })];
    const es = rankHot(list, { period: 'month', country: 'espana', now: NOW });
    expect(es.map((e) => e.slug)).toEqual(['boricua', 'local']);
    expect(es[0].geoRank).toBe(1);
    expect(es[0].reasons.join()).toMatch(/Nº 1/);
  });

  it('con fotos de antes, sube quien más crece', () => {
    const grows = artist('sube', 50, { stats: [snap('2026-10-01', 1000), snap('2026-10-25', 1500)] });
    const flat = artist('quieto', 55, { stats: [snap('2026-10-01', 1000), snap('2026-10-25', 1000)] });
    const r = rankHot([flat, grows], { period: 'week', now: NOW });
    expect(r[0].slug).toBe('sube');
    expect(r[0].growth).toBeCloseTo(0.5);
  });
});

describe('cifras del cara a cara', () => {
  it('cada valor es su parte del mayor; gana el mayor y cuenta el marcador', () => {
    const res = normalizeCompare([
      { slug: 'a', values: { youtubeViews: 1000, lastfmListeners: 50, fame: 90 } },
      { slug: 'b', values: { youtubeViews: 250, lastfmListeners: 100, fame: 90 } },
    ]);
    const yt = res.metrics.find((m) => m.id === 'youtubeViews')!;
    expect(yt.shares).toEqual({ a: 1, b: 0.25 });
    expect(yt.winners).toEqual(['a']);
    expect(res.metrics.find((m) => m.id === 'fame')!.winners).toEqual(['a', 'b']);
    expect(res.wins).toEqual({ a: 2, b: 2 });
    expect(res.champion).toBeNull();
  });

  it('sin dato no es cero: queda null, y las métricas sin datos de nadie no salen', () => {
    const res = normalizeCompare([
      { slug: 'a', values: { deezerFans: 10, streetLevel: null } },
      { slug: 'b', values: { deezerFans: null } },
      { slug: 'c', values: { deezerFans: 0 } },
    ]);
    expect(res.metrics.map((m) => m.id)).toEqual(['deezerFans']);
    expect(res.metrics[0].shares).toEqual({ a: 1, b: null, c: 0 });
    expect(res.champion).toBe('a');
  });
});

describe('1 vs 1 completo', () => {
  it('en audiencia la barra va en escala logarítmica: el pequeño se ve, pero gana el grande', () => {
    const res = normalizeCompare([
      { slug: 'leyenda', values: { youtubeViews: 21e9, yearsActive: 30 } },
      { slug: 'nuevo', values: { youtubeViews: 4e6, yearsActive: 2 } },
    ]);
    const yt = res.metrics.find((m) => m.id === 'youtubeViews')!;
    expect(yt.scale).toBe('log');
    expect(yt.winners).toEqual(['leyenda']);
    expect(yt.shares.nuevo).toBeLessThan(0.001);
    expect(yt.bars.nuevo).toBeGreaterThan(0.6);
    const years = res.metrics.find((m) => m.id === 'yearsActive')!;
    expect(years.bars).toEqual(years.shares);
  });

  it('años en activo cuentan el del debut y paran si lo dejó', () => {
    expect(yearsActive(2016, null, NOW)).toBe(11);
    expect(yearsActive(2004, 2010, NOW)).toBe(7);
    expect(yearsActive(2026, null, NOW)).toBe(1);
    expect(yearsActive(null, null, NOW)).toBeNull();
  });

  it('reconoce colaboraciones en el título', () => {
    expect(isCollab('Luna (feat. ATL Jacob)')).toBe(true);
    expect(isCollab('Bichiyal ft. Jhay Cortez')).toBe(true);
    expect(isCollab('Feid x ATL Jacob - Luna')).toBe(true);
    expect(isCollab('Xtasis')).toBe(false);
    expect(isCollab('Felices los 4')).toBe(false);
  });

  it('el historial cuenta los días distintos entre todos', () => {
    const s = (day: string, n: number): StatSnapshot => ({ day, lastfmListeners: n, lastfmPlays: null, deezerFans: null, youtubeViews: null, geo: {} });
    const one = compareHistory({ a: [s('2026-10-26', 1)], b: [s('2026-10-26', 2)] });
    expect(one.days).toBe(1);
    const two = compareHistory({ a: [s('2026-10-25', 1), s('2026-10-26', 2)], b: [] });
    expect(two.days).toBe(2);
    expect(two.history.a.map((p) => p.lastfmListeners)).toEqual([1, 2]);
    expect(compareHistory({ a: [s('1', 1), s('2', 2), s('3', 3)] }, 2).history.a.map((p) => p.day)).toEqual(['2', '3']);
  });
});
