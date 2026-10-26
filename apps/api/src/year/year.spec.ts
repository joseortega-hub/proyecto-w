import { describe, expect, it } from 'vitest';
import { renderCard } from './year-card.js';
import { buildYear, longestStreak, templateHeadlines, topWords, validHeadline, yearCards, type YearDomain, type YearItem, type YearSession } from './year.js';

const domains: YearDomain[] = [
  { id: 'movies', name: 'Películas', itemNounPlural: 'películas', attributes: [{ key: 'pace', label: 'Ritmo', kind: 'scale', lowLabel: 'pausada', highLabel: 'trepidante' }] },
  { id: 'books', name: 'Libros', itemNounPlural: 'libros', attributes: [] },
];
const session = (day: string, over: Partial<YearSession> = {}): YearSession => ({
  domainId: 'movies',
  createdAt: new Date(`${day}T20:30:00Z`),
  anchors: [],
  initialText: null,
  scales: { pace: 0.8 },
  recommended: 12,
  ...over,
});
const item = (title: string, over: Partial<YearItem> = {}): YearItem => ({
  domainId: 'movies',
  title,
  subtitle: 'Denis Villeneuve',
  imageUrl: null,
  durationSec: 7200,
  rating: 'liked',
  seen: true,
  ...over,
});

describe('Tu año en Sintonía', () => {
  const sessions = [
    session('2026-03-06', { anchors: ['Marvel'] }),
    session('2026-03-07', { anchors: ['Marvel', 'zombis'] }),
    session('2026-03-08', { domainId: 'books', scales: null, anchors: ['Sarah J. Maas'] }),
  ];
  const items = [item('Arrival', { rating: 'loved' }), item('Dune'), item('Sicario', { rating: 'meh' }), item('Rayuela', { domainId: 'books', subtitle: 'Julio Cortázar', durationSec: null })];
  const year = buildYear(2026, sessions, items, domains);

  it('cuenta solo lo que hay', () => {
    expect(year.totals).toEqual({ sessions: 3, recommended: 36, seen: 4, rated: 3, domains: 2 });
    expect(year.domains[0]).toEqual({ id: 'movies', name: 'Películas', sessions: 2, seen: 3 });
    expect(year.topRated.map((r) => r.title)).toEqual(['Arrival', 'Dune', 'Rayuela']);
    // Lo «meh» no suma al creador: Villeneuve sale 2 veces, no 3; Cortázar (1) no llega.
    expect(year.creators).toEqual([{ domainId: 'movies', name: 'Denis Villeneuve', count: 2 }]);
    expect(year.words[0]).toEqual({ word: 'Marvel', count: 2 });
    expect(year.vibe).toEqual({ domainId: 'movies', name: 'Películas', sessions: 2, bars: [{ key: 'pace', label: 'Ritmo', value: 0.8, word: 'trepidante' }] });
    expect(year.facts).toContain('Tu mejor racha: 3 días seguidos');
    expect(year.facts).toContain('Sueles pedir recomendaciones por la noche');
    expect(year.facts).toContain('Tus 3 películas vistas suman 6 horas');
  });

  it('sin datos no hay tarjetas, y sin cada dato no sale su tarjeta', () => {
    expect(yearCards(buildYear(2026, [], [], domains))).toEqual([]);
    expect(yearCards(year)).toEqual(['intro', 'domains', 'rated', 'creators', 'words', 'vibe', 'facts']);
    expect(yearCards(buildYear(2026, [session('2026-01-01', { scales: null })], [], domains))).toEqual(['intro', 'domains', 'facts']);
  });

  it('palabras de los textos solo si hay pocas anclas, sin palabras vacías', () => {
    expect(topWords([{ anchors: [], initialText: 'Quiero algo tranquilo para leer' }, { anchors: [], initialText: 'algo tranquilo y corto' }])[0]).toEqual({ word: 'tranquilo', count: 2 });
  });

  it('racha de días seguidos', () => {
    expect(longestStreak(['2026-01-01', '2026-01-02', '2026-01-04', '2026-01-05', '2026-01-06'])).toBe(3);
  });

  it('un titular de la IA con cifras inventadas no vale', () => {
    expect(templateHeadlines(year).intro).toBe('3 entrevistas y 36 recomendaciones');
    expect(validHeadline('Tus 3 entrevistas dieron para mucho', year)).toBe(true);
    expect(validHeadline('Has visto 500 películas', year)).toBe(false);
    expect(validHeadline('x'.repeat(80), year)).toBe(false);
  });

  it('dibuja cada tarjeta como PNG 9:16', async () => {
    for (const kind of yearCards(year)) {
      const png = await renderCard(kind, year, templateHeadlines(year)[kind]);
      expect(png.subarray(1, 4).toString()).toBe('PNG');
      expect(png.readUInt32BE(16)).toBe(1080);
      expect(png.readUInt32BE(20)).toBe(1920);
    }
  }, 30_000);
});
