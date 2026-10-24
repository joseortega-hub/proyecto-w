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
