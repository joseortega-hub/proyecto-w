import { describe, expect, it } from 'vitest';
import { moviesDomain } from '../domains/movies.domain.js';
import { anchorMatches } from './anchors.js';
import { findEntities, tagsForTheme, type MatchableItem } from './catalog-match.js';
import { broughtBy } from './named.service.js';
import { resolveName, similarity } from './named.js';
import { toUnderstanding } from './understanding.service.js';

const config = moviesDomain.config;
const item = (id: string, title: string, subtitle: string | null, tags: string[], facets: Record<string, string | string[]> = {}) => ({
  id,
  title,
  subtitle,
  tags,
  facets,
  description: null as string | null,
  attributes: {} as Record<string, number>,
  popularity: 0,
});

describe('personas: nombre entero, no un trozo ni otro apellido', () => {
  it('"Mario Casas" no es "Mario Camus" (director) ni casa por una sola palabra', () => {
    expect(similarity('mario casas', 'Mario Camus')).toBe(0);
    expect(similarity('saran j maas', 'Sarah J. Maas')).toBeGreaterThan(0.7);
    expect(similarity('sarah j mass', 'Sarah J. Maas')).toBeGreaterThan(0.6);
    const catalog = [item('1', 'Los santos inocentes', 'Mario Camus', ['drama'])];
    expect(resolveName({ name: 'mario casas', role: 'person' }, catalog, config)).toBeNull();
  });

  it('un actor traído por la fuente vale por la etiqueta de la búsqueda en directo', () => {
    const catalog = [item('1', 'Tres metros sobre el cielo', 'Fernando González Molina', ['romance', 'mario casas'])];
    expect(broughtBy(catalog, 'Mario Casas', 'creator')).toMatchObject({ count: 1, conditions: [{ field: 'tags', values: ['mario casas'] }] });
    expect(broughtBy(catalog, 'Úrsula Corberó', 'creator')).toBeNull();
  });

  it('la IA reconoce «Mario Casas»: la saga «Mario» del catálogo no se elige', () => {
    const catalog = ['Super Mario Bros', 'Mario Kart', 'Dr. Mario'].map((t, i) => item(String(i), t, null, ['animación']));
    const entities = findEntities('una peli con mario casas', catalog, config);
    const mario = entities.find((e) => e.said === 'mario')!;
    const u = toUnderstanding(
      { anchors: [{ label: 'Mario Casas', kind: 'creator', terms: ['Mario Casas'], required: true }], picks: [{ id: mario.id, use: 'only' }] },
      config,
      entities,
      'una peli con mario casas',
    );
    expect(u.anchors.map((a) => a.label)).toEqual(['Mario Casas']);
  });
});

describe('temáticas', () => {
  it('las palabras clave en inglés casan con las etiquetas reales del catálogo', () => {
    const vocabulary = ['post-apocalyptic future', 'zombie apocalypse', 'dystopia', 'apocalypse now', 'time travel', 'war'];
    expect(tagsForTheme(['apocalypse'], vocabulary)).toEqual(['post apocalyptic future', 'zombie apocalypse', 'apocalypse now']);
    expect(tagsForTheme(['time travel'], vocabulary)).toEqual(['time travel']);
    expect(tagsForTheme(['nuclear war'], vocabulary)).toEqual([]);
  });

  it('«ciencia ficción de apocalipsis»: género pedido (filtro) + temática; «Apocalipsis Z» no es la saga pedida', () => {
    const catalog = [
      item('1', 'Mad Max: Furia en la carretera', 'George Miller', ['ciencia ficción', 'post-apocalyptic future']),
      item('2', 'Apocalipsis Z: el principio del fin', 'Carles Torrens', ['terror', 'zombie'], { collection: 'Apocalipsis Z - Colección' }),
    ];
    const text = 'quiero una peli de ciencia ficción de apocalipsis';
    const entities = findEntities(text, catalog, config);
    const scifi = entities.find((e) => e.name === 'ciencia ficción')!;
    const saga = entities.find((e) => e.name === 'Apocalipsis Z - Colección')!;
    const u = toUnderstanding(
      {
        picks: [
          { id: scifi.id, use: 'include' },
          { id: saga.id, use: 'only' },
        ],
        themes: [{ label: 'apocalipsis', keywords: ['apocalypse', 'post-apocalyptic future', 'end of the world'] }],
      },
      config,
      entities,
      text,
    );
    expect(u.anchors.map((a) => [a.label, a.required, a.theme ?? false])).toEqual([
      ['Ciencia Ficción', true, false],
      ['apocalipsis', true, true],
    ]);
  });

  it('dos cosas pedidas se suman (Y); si juntas no dejan nada, vale cualquiera', () => {
    const catalog = [
      item('1', 'Mad Max', null, ['ciencia ficción', 'apocalipsis']),
      item('2', 'Interstellar', null, ['ciencia ficción']),
      item('3', '28 días después', null, ['terror', 'apocalipsis']),
    ];
    const scifi = { label: 'ciencia ficción', kind: 'tag' as const, terms: [], required: true, match: [{ field: 'tags', values: ['ciencia ficción'] }] };
    const apo = { label: 'apocalipsis', kind: 'tag' as const, theme: true, terms: [], required: true, match: [{ field: 'tags', values: ['apocalipsis'] }] };
    expect(anchorMatches(catalog, [scifi, apo]).map((i) => i.id)).toEqual(['1']);
    const western = { ...apo, label: 'western', match: [{ field: 'tags', values: ['western'] }] };
    expect(anchorMatches(catalog, [scifi, western]).map((i) => i.id)).toEqual(['1', '2']);
    const artist = { label: 'David TMX', kind: 'creator' as const, terms: [], required: true, match: [{ field: 'tags', values: ['terror'] }] };
    expect(anchorMatches(catalog, [artist, western]).map((i) => i.id)).toEqual(['3']);
  });
});

describe('palabras comunes que se repiten en títulos', () => {
  it('«noche» no es una saga ni nombra «La noche de los muertos vivientes - Colección»; «Pokémon» sí es saga', () => {
    const catalog = [
      item('1', 'La noche de los muertos vivientes', null, ['terror'], { collection: 'La noche de los muertos vivientes - Colección' }),
      item('2', 'Una noche en el museo', null, ['comedia']),
      item('3', 'Noche de miedo', null, ['terror']),
      item('4', 'La última noche', null, ['drama']),
      item('5', 'Detective Pikachu: Pokémon', null, ['aventura']),
      item('6', 'Pokémon: Mewtwo', null, ['animación']),
      item('7', 'La película Pokémon', null, ['animación']),
    ];
    expect(findEntities('algo de miedo para esta noche', catalog, config)).toEqual([]);
    expect(findEntities('algo de pokemon', catalog, config).map((e) => e.name)).toContain('pokemon');
  });
});
