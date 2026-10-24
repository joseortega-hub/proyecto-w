import { describe, expect, it } from 'vitest';
import type { TextProvider } from '../ai/text-provider.js';
import { MusicBrainzClient, sameName } from '../musicbrainz/musicbrainz.client.js';
import { guessFromFileName, identifyTracks } from './folder.identify.js';

const fakeText = (songs: { id: string; artist: string | null; title: string }[]) =>
  ({ write: async () => ({ songs }) }) as unknown as TextProvider;

describe('nombres de archivo', () => {
  it('quita numeración, calidad y copia', () => {
    expect(guessFromFileName('01 - Bad Bunny - Monaco [Official Video] (320kbps) (2).mp3')).toEqual({ artist: 'Bad Bunny', title: 'Monaco' });
    expect(guessFromFileName('karol_g_-_provenza.mp3')).toEqual({ artist: 'karol g', title: 'provenza' });
  });
});

describe('sameName', () => {
  it('ignora tildes, mayúsculas y colaboraciones', () => {
    expect(sameName('Tití Me Preguntó', 'titi me pregunto')).toBe(true);
    expect(sameName('Bad Bunny', 'Bad Bunny & Jhay Cortez')).toBe(true);
    expect(sameName('Feid', 'Karol G')).toBe(false);
  });
});

describe('MusicBrainzClient', () => {
  const response = (recordings: unknown[]) => (async () => new Response(JSON.stringify({ recordings }))) as unknown as typeof fetch;
  const rec = (title: string, artist: string, score = 100) => ({ id: 'x', title, score, length: 200_000, 'artist-credit': [{ name: artist }] });

  it('confirma si título y artista coinciden', async () => {
    const mb = new MusicBrainzClient('test', 0, response([rec('Monaco', 'Bad Bunny')]));
    expect(await mb.findRecording('Bad Bunny', 'Monaco')).toMatchObject({ title: 'Monaco', artist: 'Bad Bunny', durationSec: 200 });
  });

  it('descarta si el artista no encaja (la IA se pudo inventar el nombre)', async () => {
    const mb = new MusicBrainzClient('test', 0, response([rec('Monaco', 'Otro Artista')]));
    expect(await mb.findRecording('Bad Bunny', 'Monaco')).toBeNull();
  });

  it('descarta puntuaciones bajas', async () => {
    const mb = new MusicBrainzClient('test', 0, response([rec('Monaco', 'Bad Bunny', 40)]));
    expect(await mb.findRecording('Bad Bunny', 'Monaco')).toBeNull();
  });
});

describe('identifyTracks', () => {
  const confirm = { findRecording: async (artist: string | null, title: string) => (title === 'Monaco' ? { id: '1', title, artist: artist ?? '', durationSec: 180, score: 100 } : null) };

  it('las etiquetas ID3 limpias no necesitan IA ni MusicBrainz', async () => {
    const [t] = await identifyTracks([{ key: 'a', fileName: 'a.mp3', title: 'Provenza', artist: 'Karol G' }], {
      text: fakeText([]),
      musicBrainz: { findRecording: async () => Promise.reject(new Error('no debería llamarse')) },
    });
    expect(t).toMatchObject({ title: 'Provenza', artist: 'Karol G', identified: 'tags', review: false });
  });

  it('un nombre sucio se limpia con IA y se confirma con MusicBrainz', async () => {
    const [t] = await identifyTracks([{ key: 'b', fileName: 'Bad Bunny - Monaco [Official Video] (320kbps).mp3' }], {
      text: fakeText([{ id: 'c1', artist: 'Bad Bunny', title: 'Monaco' }]),
      musicBrainz: confirm,
    });
    expect(t).toMatchObject({ title: 'Monaco', artist: 'Bad Bunny', identified: 'musicbrainz', review: false });
  });

  it('lo que MusicBrainz no confirma queda por revisar, también sin IA', async () => {
    const [t] = await identifyTracks([{ key: 'c', fileName: 'Artista Raro - Tema Raro (2).mp3' }], {
      text: { write: async () => Promise.reject(new Error('sin cupo')) } as unknown as TextProvider,
      musicBrainz: confirm,
    });
    expect(t).toMatchObject({ title: 'Tema Raro', artist: 'Artista Raro', identified: 'filename', review: true });
  });
});
