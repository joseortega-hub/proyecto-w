import { anchorMatchesText } from '../interview/anchors.js';
import type { Anchor } from '../interview/interview.types.js';
import type { CatalogAdapter, ImportedItem } from './catalog-adapter.js';

interface JamendoTrack {
  id: string;
  name: string;
  duration: number;
  artist_name: string;
  album_name: string;
  image: string;
  audio: string;
  shareurl: string;
  audiodownload_allowed: boolean;
  lyrics?: string;
  musicinfo?: {
    vocalinstrumental?: 'vocal' | 'instrumental';
    /** Idioma de la letra (ISO 639-1); vacío si Jamendo no lo sabe. */
    lang?: string;
    speed?: 'verylow' | 'low' | 'medium' | 'high' | 'veryhigh';
    tags?: { genres?: string[]; instruments?: string[]; vartags?: string[] };
  };
}

/** Etiquetas de Jamendo con las que se siembra el catálogo, para cubrir estilos variados. */
export const SEED_TAGS = [
  'pop', 'rock', 'electronic', 'hiphop', 'jazz', 'classical', 'ambient', 'lounge', 'folk', 'reggae',
  'latin', 'reggaeton', 'metal', 'chillout', 'soundtrack', 'funk', 'rnb', 'dance', 'world', 'acoustic',
  'piano', 'indie',
];

type Scales = { energy: number; positivity: number; focus: number; acoustic: number; dance: number };

// Valores de partida por género; la velocidad, el ánimo y los instrumentos los ajustan después.
const GENRE_PRIORS: Record<string, Partial<Scales>> = {
  ambient: { energy: 0.15, positivity: 0.5, acoustic: 0.3, dance: 0.1, focus: 0.9 },
  classical: { energy: 0.25, positivity: 0.5, acoustic: 0.95, dance: 0.1, focus: 0.85 },
  piano: { energy: 0.2, acoustic: 0.9, dance: 0.1, focus: 0.85 },
  jazz: { energy: 0.4, positivity: 0.6, acoustic: 0.8, dance: 0.4, focus: 0.6 },
  blues: { energy: 0.45, positivity: 0.4, acoustic: 0.75, dance: 0.35, focus: 0.45 },
  lounge: { energy: 0.3, positivity: 0.6, acoustic: 0.45, dance: 0.45, focus: 0.7 },
  chillout: { energy: 0.3, positivity: 0.6, acoustic: 0.35, dance: 0.4, focus: 0.75 },
  folk: { energy: 0.35, positivity: 0.55, acoustic: 0.9, dance: 0.3, focus: 0.5 },
  acoustic: { energy: 0.3, positivity: 0.55, acoustic: 0.95, dance: 0.25, focus: 0.55 },
  pop: { energy: 0.6, positivity: 0.7, acoustic: 0.4, dance: 0.65, focus: 0.3 },
  rock: { energy: 0.75, positivity: 0.5, acoustic: 0.5, dance: 0.45, focus: 0.25 },
  indie: { energy: 0.55, positivity: 0.55, acoustic: 0.55, dance: 0.45, focus: 0.35 },
  metal: { energy: 0.95, positivity: 0.3, acoustic: 0.4, dance: 0.3, focus: 0.1 },
  punk: { energy: 0.9, positivity: 0.5, acoustic: 0.4, dance: 0.5, focus: 0.1 },
  electronic: { energy: 0.7, positivity: 0.6, acoustic: 0.1, dance: 0.75, focus: 0.45 },
  dance: { energy: 0.85, positivity: 0.75, acoustic: 0.1, dance: 0.95, focus: 0.2 },
  house: { energy: 0.8, positivity: 0.7, acoustic: 0.1, dance: 0.9, focus: 0.3 },
  techno: { energy: 0.85, positivity: 0.5, acoustic: 0.05, dance: 0.9, focus: 0.4 },
  hiphop: { energy: 0.65, positivity: 0.5, acoustic: 0.2, dance: 0.75, focus: 0.25 },
  rap: { energy: 0.7, positivity: 0.45, acoustic: 0.2, dance: 0.7, focus: 0.15 },
  rnb: { energy: 0.5, positivity: 0.6, acoustic: 0.3, dance: 0.65, focus: 0.3 },
  reggae: { energy: 0.5, positivity: 0.75, acoustic: 0.5, dance: 0.7, focus: 0.3 },
  latin: { energy: 0.75, positivity: 0.8, acoustic: 0.35, dance: 0.9, focus: 0.15 },
  reggaeton: { energy: 0.8, positivity: 0.75, acoustic: 0.15, dance: 0.95, focus: 0.1 },
  funk: { energy: 0.7, positivity: 0.8, acoustic: 0.4, dance: 0.85, focus: 0.2 },
  soundtrack: { energy: 0.45, positivity: 0.45, acoustic: 0.5, dance: 0.15, focus: 0.75 },
  world: { energy: 0.5, positivity: 0.6, acoustic: 0.7, dance: 0.55, focus: 0.4 },
};

const SPEED: Record<string, number> = { verylow: 0.1, low: 0.3, medium: 0.5, high: 0.75, veryhigh: 0.95 };
const MOOD_UP = ['energetic', 'powerful', 'upbeat', 'party', 'aggressive', 'epic', 'motivational'];
const MOOD_DOWN = ['calm', 'relaxing', 'relaxed', 'peaceful', 'soft', 'dreamy', 'chill', 'meditative'];
const MOOD_HAPPY = ['happy', 'fun', 'positive', 'uplifting', 'joyful', 'optimistic', 'party', 'summer'];
const MOOD_SAD = ['sad', 'melancholic', 'dark', 'emotional', 'nostalgic', 'melancholy', 'sombre'];
const ACOUSTIC_INSTRUMENTS = ['acousticguitar', 'piano', 'violin', 'strings', 'cello', 'flute', 'harp', 'saxophone'];
const ELECTRONIC_INSTRUMENTS = ['synthesizer', 'electricguitar', 'drummachine', 'beat', 'computer'];

const clamp = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 100) / 100;
const hits = (list: string[], words: string[]) => list.filter((w) => words.includes(w)).length;

/** Traduce la información musical de Jamendo a los atributos de escala del dominio. */
export function deriveAttributes(info: JamendoTrack['musicinfo']): Record<string, number> {
  const genres = info?.tags?.genres ?? [];
  const moods = info?.tags?.vartags ?? [];
  const instruments = info?.tags?.instruments ?? [];

  const base: Scales = { energy: 0.5, positivity: 0.5, focus: 0.4, acoustic: 0.5, dance: 0.5 };
  const priors = genres.map((g) => GENRE_PRIORS[g]).filter(Boolean);
  for (const key of Object.keys(base) as (keyof Scales)[]) {
    const values = priors.map((p) => p[key]).filter((v): v is number => v !== undefined);
    if (values.length) base[key] = values.reduce((a, b) => a + b, 0) / values.length;
  }

  if (info?.speed) {
    base.energy = base.energy * 0.6 + SPEED[info.speed] * 0.4;
    base.dance = base.dance * 0.75 + SPEED[info.speed] * 0.25;
  }
  base.energy += 0.12 * hits(moods, MOOD_UP) - 0.12 * hits(moods, MOOD_DOWN);
  base.positivity += 0.12 * hits(moods, MOOD_HAPPY) - 0.12 * hits(moods, MOOD_SAD);
  base.acoustic += 0.15 * hits(instruments, ACOUSTIC_INSTRUMENTS) - 0.15 * hits(instruments, ELECTRONIC_INSTRUMENTS);

  const instrumental = info?.vocalinstrumental === 'instrumental';
  const vocal = info?.vocalinstrumental === 'vocal' ? 0.9 : instrumental ? 0.05 : 0.5;
  base.focus += instrumental ? 0.15 : info?.vocalinstrumental === 'vocal' ? -0.1 : 0;
  base.focus -= Math.max(0, base.energy - 0.7) * 0.5;

  return {
    energy: clamp(base.energy),
    positivity: clamp(base.positivity),
    focus: clamp(base.focus),
    acoustic: clamp(base.acoustic),
    vocal,
    dance: clamp(base.dance),
  };
}

/**
 * Faceta `language` del dominio música: es, en, other o instrumental. Devuelve null
 * si la pista tiene voz pero Jamendo no da el idioma (se clasifica en el seed).
 */
export function languageFacet(info: JamendoTrack['musicinfo']): string | null {
  if (info?.vocalinstrumental === 'instrumental') return 'instrumental';
  const lang = info?.lang?.trim().toLowerCase();
  if (!lang) return null;
  return lang === 'es' || lang === 'en' ? lang : 'other';
}

export class JamendoAdapter implements CatalogAdapter {
  readonly domainId = 'music';
  readonly source = 'jamendo';

  constructor(
    private readonly clientId: string,
    private readonly tags: string[] = SEED_TAGS,
  ) {
    if (!clientId) throw new Error('Falta JAMENDO_CLIENT_ID en .env');
  }

  async fetchItems({ limit, onProgress }: { limit: number; onProgress?: (m: string) => void }) {
    const perTag = Math.min(200, Math.ceil(limit / this.tags.length));
    const byId = new Map<string, ImportedItem>();

    for (const tag of this.tags) {
      // Con `tags` Jamendo a veces devuelve 0 resultados; `fuzzytags` es más permisivo.
      let tracks = await this.fetchTag('tags', tag, perTag);
      if (!tracks.length) tracks = await this.fetchTag('fuzzytags', tag, perTag);
      tracks.forEach((t, rank) => {
        if (!t.audio || byId.has(t.id)) return;
        byId.set(t.id, this.toItem(t, 1 - rank / tracks.length));
      });
      onProgress?.(`${tag}: ${tracks.length} pistas (total único: ${byId.size})`);
    }
    return [...byId.values()];
  }

  /** Búsqueda en directo: por artista si pidió a alguien, por texto (nombres y etiquetas) en el resto. */
  async search(anchor: Anchor, limit: number): Promise<ImportedItem[]> {
    const tracks = await this.fetchTag(anchor.kind === 'creator' ? 'artist_name' : 'search', anchor.label, limit * 2).catch(() => [] as JamendoTrack[]);
    return tracks
      .filter((t) => t.audio && anchorMatchesText(`${t.name} ${t.artist_name} ${t.album_name} ${(t.musicinfo?.tags?.genres ?? []).join(' ')}`, anchor))
      .slice(0, limit)
      .map((t, rank, all) => this.toItem(t, 1 - rank / all.length));
  }

  private async fetchTag(param: 'tags' | 'fuzzytags' | 'search' | 'artist_name', tag: string, limit: number): Promise<JamendoTrack[]> {
    const url = new URL('https://api.jamendo.com/v3.0/tracks/');
    url.search = new URLSearchParams({
      client_id: this.clientId,
      format: 'json',
      limit: String(limit),
      [param]: tag,
      include: 'musicinfo lyrics',
      audioformat: 'mp32',
      imagesize: '300',
      order: 'popularity_total',
    }).toString();

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Jamendo respondió ${res.status} para la etiqueta ${tag}`);
    const body = (await res.json()) as { headers: { status: string; error_message: string }; results: JamendoTrack[] };
    if (body.headers.status !== 'success') throw new Error(`Jamendo: ${body.headers.error_message}`);
    return body.results;
  }

  /** `popularity` es la posición relativa dentro de su etiqueta (1 = la más escuchada). */
  private toItem(t: JamendoTrack, popularity: number): ImportedItem {
    const genres = t.musicinfo?.tags?.genres ?? [];
    const moods = t.musicinfo?.tags?.vartags ?? [];
    const language = languageFacet(t.musicinfo);
    return {
      source: this.source,
      externalId: t.id,
      title: t.name,
      subtitle: t.artist_name,
      description: t.album_name,
      imageUrl: t.image || null,
      mediaUrl: t.audio,
      externalUrl: t.shareurl,
      durationSec: t.duration,
      attributes: deriveAttributes(t.musicinfo),
      tags: [...new Set([...genres, ...moods])],
      popularity: Math.round(popularity * 100) / 100,
      facets: language ? { language } : {},
      classifyHints: t.lyrics ? `Letra: ${t.lyrics.replace(/\s+/g, ' ').slice(0, 300)}` : undefined,
    };
  }
}
