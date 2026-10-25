import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/client.js';
import { candidateLinks, claimValues, describedDomain, fandomCheck, fandomUrl, pickEntity, verifyUrl, type WikidataEntity } from './links.js';
import { LinksService, sessionAnchor } from './links.service.js';
import { SourcesService } from './sources.service.js';

type Claims = NonNullable<WikidataEntity['claims']>;
const claim = (value: unknown, rank = 'normal') => ({ rank, mainsnak: { datavalue: { value } } });
const entity = (id: string, label: string, desc: string, claims: Record<string, unknown[]>, eswiki?: string, aliases: string[] = []): WikidataEntity => ({
  id,
  labels: { es: { value: label } },
  aliases: { es: aliases.map((value) => ({ value })) },
  descriptions: { es: { value: desc } },
  claims: Object.fromEntries(Object.entries(claims).map(([p, vs]) => [p, vs.map((v) => (Array.isArray(v) ? claim(v[0], v[1]) : claim(v)))])) as Claims,
  sitelinks: eswiki ? { eswiki: { title: eswiki } } : {},
});

const badBunny = entity(
  'Q44333953',
  'Bad Bunny',
  'rapero, cantante y productor discográfico puertorriqueño',
  { P31: [{ id: 'Q5' }], P2003: ['badbunnypr'], P2002: ['sanbenito'], P2397: ['UCmBA_wu8xGg1OfOkfW13Q0Q'], P434: ['89aa5ecb-59ad-46f5-b3eb-2d424e941f19'], P4985: ['2550161'] },
  'Bad Bunny',
);
const potterBooks = entity(
  'Q8337',
  'Harry Potter',
  'heptalogía literaria de J. K. Rowling (1997-2007)',
  { P31: [{ id: 'Q614101' }], P856: ['https://harrypotter.com'], P6262: ['harrypotter:Main_Page'], P3984: ['harrypotter'], P2003: ['harrypotterfilm'] },
  'Harry Potter',
);
const potterFilms = entity(
  'Q216930',
  'Harry Potter',
  'serie cinematográfica basada en las novelas de Harry Potter',
  { P31: [{ id: 'Q24856' }], P856: ['http://www.harrypotter.com/'], P6262: ['harrypotter:Harry_Potter_(film_series)'], P2002: ['HarryPotterFilm'], P11805: ['1241'] },
  'Harry Potter (serie cinematográfica)',
);
const potterCharacter = entity('Q3244512', 'Harry Potter', 'personaje de la serie Harry Potter', { P31: [[{ id: 'Q15773347' }, 'preferred']], P6262: ['harrypotter:Harry_Potter'] }, 'Harry Potter (personaje)');
const marvelSurname = entity('Q16279091', 'Marvel', 'apellido', { P31: [{ id: 'Q101352' }], P856: ['https://example.org'] });
const mcu = entity(
  'Q642878',
  'Universo cinematográfico de Marvel',
  'universo cinematográfico ficticio compartido entre películas producidas por Marvel Studios',
  { P856: ['https://www.marvel.com/movies'], P6262: ['marvel:Earth-199999', 'es.marvel:Tierra-199999'], P4073: ['marvelcinematicuniverse'] },
  'Universo cinematográfico de Marvel',
  ['Marvel'],
);

describe('Wikidata → enlaces', () => {
  it('lee los valores sin los obsoletos y con los preferidos primero', () => {
    const nintendo = entity('Q8093', 'Nintendo', 'empresa', {
      P856: [['https://www.nintendo.com/countryselector/', 'deprecated'], 'https://www.nintendo.de/', ['https://www.nintendo.com/jp/index.html', 'preferred']],
    });
    expect(claimValues(nintendo, 'P856')).toEqual(['https://www.nintendo.com/jp/index.html', 'https://www.nintendo.de/']);
    expect(claimValues(badBunny, 'P31')).toEqual(['Q5']);
  });

  it('arma los enlaces de un artista en orden: Wikipedia, MusicBrainz y redes oficiales', () => {
    expect(candidateLinks(badBunny, 'music')).toEqual([
      { site: 'wikipedia', url: 'https://es.wikipedia.org/wiki/Bad_Bunny' },
      { site: 'musicbrainz', url: 'https://musicbrainz.org/artist/89aa5ecb-59ad-46f5-b3eb-2d424e941f19' },
      { site: 'instagram', url: 'https://www.instagram.com/badbunnypr/' },
      { site: 'youtube', url: 'https://www.youtube.com/channel/UCmBA_wu8xGg1OfOkfW13Q0Q' },
      { site: 'x', url: 'https://x.com/sanbenito' },
    ]);
  });

  it('la ficha del catálogo depende de la temática', () => {
    expect(candidateLinks(badBunny, 'movies').map((l) => l.url)).toContain('https://www.themoviedb.org/person/2550161');
    expect(candidateLinks(potterFilms, 'movies').find((l) => l.site === 'tmdb')?.url).toBe('https://www.themoviedb.org/collection/1241');
    const maas = entity('Q20640708', 'Sarah J. Maas', 'escritora estadounidense', { P648: ['OL7115219A'] });
    expect(candidateLinks(maas, 'books')).toEqual([{ site: 'openlibrary', url: 'https://openlibrary.org/authors/OL7115219A' }]);
    expect(candidateLinks(maas, 'games')).toEqual([]);
  });

  it('Fandom: el artículo en español si lo hay; si no, la wiki entera', () => {
    expect(fandomUrl(mcu)).toBe('https://marvel.fandom.com/es/wiki/Tierra-199999');
    expect(fandomUrl(potterFilms)).toBe('https://harrypotter.fandom.com/wiki/Harry_Potter_(film_series)');
    expect(fandomUrl(entity('Q1', 'X', '', { P4073: ['nintendo'] }))).toBe('https://nintendo.fandom.com/');
    expect(fandomUrl(entity('Q1', 'X', '', { P4073: ['nombre raro/../'] }))).toBeNull();
  });

  it('descarta usuarios de redes con caracteres raros', () => {
    const odd = entity('Q1', 'X', '', { P2003: ['a/b?c'], P3984: ['ok_sub'] });
    expect(candidateLinks(odd, 'music')).toEqual([{ site: 'reddit', url: 'https://www.reddit.com/r/ok_sub/' }]);
  });

  it('la descripción delata la temática por la palabra que aparece antes', () => {
    expect(describedDomain('serie cinematográfica basada en las novelas')).toBe('movies');
    expect(describedDomain('heptalogía literaria')).toBe('books');
    expect(describedDomain('empresa japonesa creadora de videojuegos')).toBe('games');
    expect(describedDomain('apellido')).toBeNull();
  });
});

describe('Elegir la entidad', () => {
  const potter = [potterCharacter, potterFilms, potterBooks];
  it('en películas, la saga de cine; en libros, la saga de novelas; nunca el personaje', () => {
    expect(pickEntity('Harry Potter', 'movies', potter)?.id).toBe('Q216930');
    expect(pickEntity('Harry Potter', 'books', potter)?.id).toBe('Q8337');
  });

  it('salta apellidos y desambiguaciones y acepta alias ("Marvel")', () => {
    expect(pickEntity('marvel', 'movies', [marvelSurname, mcu])?.id).toBe('Q642878');
  });

  it('lee los nombres en `mul` y no confunde al artista con su discografía', () => {
    const artist: WikidataEntity = { ...badBunny, labels: { mul: { value: 'Bad Bunny' } } };
    const discography = entity('Q55639250', 'Anexo:Discografía de Bad Bunny', 'discografía del artista de Wikimedia', { P31: [{ id: 'Q104635718' }] }, 'Anexo:Discografía de Bad Bunny');
    expect(pickEntity('Bad Bunny', 'music', [artist, discography])?.id).toBe('Q44333953');
    expect(pickEntity('Bad Bunny', 'music', [discography])).toBeNull();
  });

  it('sin un nombre que coincida no se elige nada', () => {
    expect(pickEntity('Bad Bunny', 'music', [potterBooks])).toBeNull();
    expect(pickEntity('Harry', 'books', [potterBooks])?.id).toBe('Q8337');
  });
});

describe('Verificar cada URL', () => {
  const reply = (...statuses: (number | Error)[]) => {
    const fn = vi.fn(async () => {
      const next = statuses.shift()!;
      if (next instanceof Error) throw next;
      return new Response(null, { status: next });
    });
    return fn as unknown as typeof fetch & typeof fn;
  };

  it('vale un 2xx o 3xx con HEAD', async () => {
    const f = reply(200);
    expect(await verifyUrl('https://a.test', f)).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('si el sitio no acepta HEAD, prueba un GET corto con Range', async () => {
    const f = reply(403, 206);
    expect(await verifyUrl('https://fandom.test', f)).toBe(true);
    expect((f.mock.calls[1] as unknown as [string, RequestInit])[1]).toMatchObject({ method: 'GET', headers: { Range: 'bytes=0-2047' } });
  });

  it('Fandom se comprueba por su API: la página tiene que existir', async () => {
    expect(fandomCheck('https://marvel.fandom.com/es/wiki/Tierra-199999')).toBe('https://marvel.fandom.com/es/api.php?action=query&titles=Tierra-199999&format=json');
    expect(fandomCheck('https://nintendo.fandom.com/')).toBe('https://nintendo.fandom.com/api.php?action=query&meta=siteinfo&format=json');
    expect(fandomCheck('https://es.wikipedia.org/wiki/X')).toBeNull();
    const api = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
    expect(await verifyUrl('https://marvel.fandom.com/wiki/A', api({ query: { pages: { '3148': { title: 'A' } } } }))).toBe(true);
    expect(await verifyUrl('https://marvel.fandom.com/wiki/B', api({ query: { pages: { '-1': { title: 'B', missing: '' } } } }))).toBe(false);
    expect(await verifyUrl('https://marvel.fandom.com/', api({ query: { general: { sitename: 'Marvel' } } }))).toBe(true);
  });

  it('un 404, un 500 o una red caída no valen', async () => {
    expect(await verifyUrl('https://a.test', reply(404))).toBe(false);
    expect(await verifyUrl('https://a.test', reply(500))).toBe(false);
    expect(await verifyUrl('https://a.test', reply(405, 404))).toBe(false);
    expect(await verifyUrl('https://a.test', reply(new Error('timeout')))).toBe(false);
  });
});

/** BD falsa con lo justo para `source_cache`: select…where e insert…onConflictDoUpdate. */
function fakeDb(rows = new Map<string, { payload: unknown; fetchedAt: Date }>()) {
  let lastKey = '';
  const db = {
    select: () => ({ from: () => ({ where: async () => (rows.has(lastKey) ? [{ key: lastKey, ...rows.get(lastKey)! }] : []) }) }),
    insert: () => ({
      values: (v: { key: string; payload: unknown }) => ({
        onConflictDoUpdate: async () => void rows.set(v.key, { payload: v.payload, fetchedAt: new Date() }),
      }),
    }),
  };
  return { rows, db: db as unknown as Db, setKey: (k: string) => (lastKey = k) };
}

describe('Caché en source_cache', () => {
  it('guarda lo pedido, lo reutiliza y no guarda los fallos', async () => {
    const { rows, db, setKey } = fakeDb();
    const sources = new SourcesService(db);
    const fetcher = vi.fn(async () => ['dato']);
    setKey('k1');
    expect(await sources.cached('k1', [], fetcher)).toEqual(['dato']);
    expect(await sources.cached('k1', [], fetcher)).toEqual(['dato']);
    expect(fetcher).toHaveBeenCalledTimes(1);
    setKey('k2');
    expect(await sources.cached('k2', ['vacío'], async () => Promise.reject(new Error('caído')))).toEqual(['vacío']);
    expect(rows.has('k2')).toBe(false);
  });

  it('pasado un mes se vuelve a pedir', async () => {
    const { rows, db, setKey } = fakeDb();
    rows.set('viejo', { payload: ['antiguo'], fetchedAt: new Date(Date.now() - 31 * 24 * 60 * 60_000) });
    setKey('viejo');
    expect(await new SourcesService(db).cached('viejo', [], async () => ['nuevo'])).toEqual(['nuevo']);
  });
});

describe('LinksService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('busca en Wikidata, elige la entidad, devuelve solo los enlaces que responden y lo cachea', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const body = url.includes('wbsearchentities') ? { search: [{ id: 'Q44333953' }] } : { entities: { Q44333953: badBunny } };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const store = new Map<string, unknown>();
    const sources = { cached: async (key: string, _fallback: unknown, fetcher: () => Promise<unknown>) => store.get(key) ?? store.set(key, await fetcher()).get(key) } as unknown as SourcesService;
    const service = new LinksService(sources, {} as Db);
    service.verify = async (url) => !url.includes('x.com');

    const [first, again] = await Promise.all([service.forEntity('music', 'Bad Bunny'), service.forEntity('music', 'bad  bunny')]);
    expect(first.entity).toMatchObject({ id: 'Q44333953', label: 'Bad Bunny' });
    expect(first.links.map((l) => l.site)).toEqual(['wikipedia', 'musicbrainz', 'instagram', 'youtube']);
    expect(again).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect([...store.keys()]).toEqual(['links:music:bad bunny']);
    await service.forEntity('music', 'Bad Bunny');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('en el resultado usa la primera ancla que es una entidad, no un estilo', async () => {
    expect(sessionAnchor([{ label: 'acción', kind: 'tag' }, { label: 'Marvel', kind: 'franchise' }])).toBe('Marvel');
    expect(sessionAnchor([{ label: 'acción', kind: 'tag' }])).toBeNull();
    const db = { select: () => ({ from: () => ({ where: async () => [{ domainId: 'games', anchors: [{ label: 'Nintendo', kind: 'creator' }] }] }) }) } as unknown as Db;
    const cached = vi.fn(async () => ({ query: 'Nintendo', entity: null, links: [] }));
    await new LinksService({ cached } as unknown as SourcesService, db).forSession('s1');
    expect(cached).toHaveBeenCalledWith('links:games:nintendo', expect.anything(), expect.any(Function));
  });

  it('con un nombre demasiado corto no consulta nada', async () => {
    const sources = { cached: vi.fn() } as unknown as SourcesService;
    expect(await new LinksService(sources, {} as Db).forEntity('music', 'x')).toEqual({ query: 'x', entity: null, links: [] });
    expect(sources.cached).not.toHaveBeenCalled();
  });
});
