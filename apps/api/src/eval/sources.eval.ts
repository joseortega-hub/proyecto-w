/**
 * Evals de las fuentes extra de refuerzo (`pnpm eval`, escenario `sources`): cada una devuelve
 * datos reales de su servicio (Wikidata, Last.fm, ListenBrainz, TMDB, Google Books). Se ejecutan
 * contra los servicios reales y se saltan si falta la clave.
 */
import { config } from '../config.js';
import { createDb } from '../db/client.js';
import { SourcesService } from '../sources/sources.service.js';

export interface SourceCheck {
  id: string;
  title: string;
  failures: string[];
}

const has = (list: string[], ...needles: string[]) => list.some((x) => needles.some((n) => x.toLowerCase().includes(n.toLowerCase())));

export async function runSourceChecks(): Promise<SourceCheck[]> {
  const { db, client } = createDb();
  const sources = new SourcesService(db);
  const out: SourceCheck[] = [];
  const check = async (id: string, title: string, fn: () => Promise<string[]>) => {
    out.push({ id, title, failures: await fn().catch((e: Error) => [`error: ${e.message}`]) });
  };

  await check('wikidata-saga', 'Wikidata: «Harry Potter» → sus obras (libros y películas)', async () => {
    const works = await sources.franchiseWorks('Harry Potter');
    return [works.length < 5 ? `solo ${works.length} obras` : '', has(works, 'piedra filosofal', "philosopher's stone", 'sorcerer') ? '' : 'falta la primera entrega'].filter(Boolean);
  });
  if (config.lastfmApiKey) {
    await check('lastfm-similar', 'Last.fm: artistas parecidos a Wisin & Yandel', async () => {
      const names = await sources.similarArtists('Wisin & Yandel');
      return [names.length < 3 ? `solo ${names.length} artistas` : '', has(names, 'Don Omar', 'Daddy Yankee', 'Zion', 'Tego', 'Plan B', 'Arcángel') ? '' : `sin reguetoneros conocidos: ${names.join(', ')}`].filter(Boolean);
    });
    await check('lastfm-tag', 'Last.fm: mejores artistas de «reggaeton»', async () => {
      const names = await sources.tagArtists('reggaeton');
      return [has(names, 'Daddy Yankee', 'Bad Bunny', 'Don Omar', 'J Balvin') ? '' : `sin los grandes: ${names.join(', ')}`].filter(Boolean);
    });
  }
  await check('listenbrainz', 'ListenBrainz: artistas parecidos (respaldo sin Last.fm)', async () => {
    const saved = config.lastfmApiKey;
    (config as { lastfmApiKey: string }).lastfmApiKey = '';
    try {
      const names = await sources.similarArtists('Daddy Yankee');
      return [names.length < 3 ? `solo ${names.length} artistas` : ''].filter(Boolean);
    } finally {
      (config as { lastfmApiKey: string }).lastfmApiKey = saved;
    }
  });
  if (config.tmdbApiKey) {
    await check('tmdb-similar', 'TMDB: parecidas a «Inception»', async () => {
      const titles = await sources.similarMovies('Inception');
      return [titles.length < 3 ? `solo ${titles.length} películas` : ''].filter(Boolean);
    });
  }
  await check('google-books', 'Google Books: «Dune» de Frank Herbert en español', async () => {
    const book = await sources.spanishBook('Dune', 'Frank Herbert');
    return [book ? '' : 'sin edición en español', book && !book.description ? 'sin sinopsis' : ''].filter(Boolean);
  });
  await client.end();
  return out;
}
