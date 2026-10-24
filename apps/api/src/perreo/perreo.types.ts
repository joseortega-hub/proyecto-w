/** Lo que escribe `pnpm perreo:import` en data/privado/perreo/ y lee `pnpm perreo:load`. */
export interface PerreoArtistFile {
  slug: string;
  name: string;
  realName: string | null;
  birthDate: string | null;
  country: string | null;
  city: string | null;
  countries: string[];
  debutYear: number | null;
  fame: number;
  listeners: number | null;
  styles: string[];
  labels: { name: string; start: number | null; end: number | null }[];
  links: Record<string, string>;
  bio: string | null;
  bioSource: string | null;
  youtubeChannelId: string | null;
  similar: string[];
  /** La foto está en photos/<slug>.webp. */
  hasPhoto: boolean;
  /** 'urbanopedia' (los 66) o 'instagram'. */
  source?: 'urbanopedia' | 'instagram';
  /** La persona lo sigue en Instagram. */
  followed?: boolean;
}

/** Lo que ig-overlay.json añade a un artista de los 66 que la persona sigue. */
export interface PerreoOverlay {
  followed: true;
  instagram: string;
  /** Parecidos extra entre los artistas de Instagram. */
  similar: string[];
}

/** Un artista de instagram.json (los que sigue la persona). */
export interface IgArtist {
  name: string;
  instagram: string;
  wikidata?: string | null;
  mbid?: string | null;
  via: 'wikidata' | 'musicbrainz' | 'lastfm' | 'revisado';
}

/** Una cuenta dudosa de la segunda pasada (ig-review.json). */
export interface IgReview {
  id: string;
  name: string;
  reason: string;
  listeners: number | null;
  tags: string[];
  mbid: string | null;
  qid: string | null;
}

export interface PerreoSongFile {
  videoId: string;
  title: string;
  artistSlug: string;
  artistName: string;
  /** 0–1: las más escuchadas de Last.fm van primero. */
  popularity: number;
  durationSec?: number;
  attributes?: Record<string, number>;
  tags?: string[];
  language?: string;
}
