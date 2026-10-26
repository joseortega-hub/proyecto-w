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
  /** Quién es: artista, productor, sello… (por defecto, artista). */
  kind?: string;
  /** Ficha mínima: falta completar datos (sin inventar nada). */
  incomplete?: boolean;
  /** Los rellena la ficha de favoritos si están vacíos. */
  aliases?: string[];
  collaborators?: string[];
  activeUntil?: number | null;
  /** Puesto en la lista de favoritos (lo pone perreo:load desde favoritos.json). */
  favoriteRank?: number | null;
  profile?: PerreoProfile;
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
  via: 'wikidata' | 'musicbrainz' | 'lastfm' | 'revisado' | 'sin-resolver';
  /** Tipo según el mejor indicio disponible. */
  kind?: string;
  /** Lote de 300 cuentas al que pertenece (por su posición en la exportación). */
  batch?: number;
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

/** Un lanzamiento de la discografía (MusicBrainz o Deezer). */
export interface ProfileRelease {
  title: string;
  /** album, ep, single… */
  type: string;
  /** AAAA-MM-DD, AAAA-MM o AAAA. */
  date: string | null;
}

/** Ficha ampliada de un favorito (columna `profile`). Todo es opcional: cada fuente que falla deja su parte vacía. */
export interface PerreoProfile {
  updatedAt?: string;
  /** Fuentes que respondieron: wikidata, musicbrainz, lastfm, deezer, youtube. */
  sources?: string[];
  wikidata?: string | null;
  mbid?: string | null;
  birthPlace?: string | null;
  origin?: string | null;
  activeFrom?: number | null;
  activeTo?: number | null;
  awards?: string[];
  labels?: string[];
  socials?: Record<string, string>;
  discography?: ProfileRelease[];
  lastfm?: { listeners: number | null; playcount: number | null; tags: string[]; similar: string[] };
  deezer?: { id: number; fans: number | null; albums: number | null; link: string; topTracks: string[] };
  youtube?: { channelId: string; title: string; subscribers: number | null; views: number | null; videos: number | null; topVideos: { id: string; title: string; views: number; publishedAt: string }[] };
  /** Grupo ↔ miembros (slugs del Modo Perreo). */
  members?: string[];
  memberOf?: string[];
}
