/**
 * Datos "para frikis" de un elemento: créditos y ficha técnica que salen de las APIs
 * (TMDB, RAWG, Open Library, Jamendo y MusicBrainz), nunca de la IA. Todo es opcional:
 * lo que la fuente no trae, no se guarda ni se muestra.
 */
export interface ItemDetails {
  // Películas
  director?: string;
  cast?: string[];
  year?: number;
  runtimeMin?: number;
  /** Nota media de la fuente (0–10). */
  rating?: number;
  // Videojuegos
  developers?: string[];
  publishers?: string[];
  /** Fecha de lanzamiento (AAAA-MM-DD). */
  released?: string;
  metacritic?: number;
  platforms?: string[];
  // Libros
  authors?: string[];
  pages?: number;
  subjects?: string[];
  // Música
  album?: string;
  producers?: string[];
  composers?: string[];
  lyricists?: string[];
  featured?: string[];
  /** MusicBrainz ya se consultó (aunque no haya devuelto nada): no se vuelve a pedir. */
  musicbrainz?: { checkedAt: string; mbid?: string };
}

/** Quita claves vacías para guardar solo lo que la fuente trae. */
export function compactDetails(details: ItemDetails): ItemDetails {
  return Object.fromEntries(
    Object.entries(details).filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)),
  ) as ItemDetails;
}

const yearOf = (date?: string | null) => Number(date?.slice(0, 4)) || undefined;

export const movieDetails = (m: {
  release_date?: string;
  runtime?: number | null;
  vote_average?: number;
  vote_count?: number;
  credits?: { crew: { job: string; name: string }[]; cast?: { name: string; order?: number }[] };
}): ItemDetails =>
  compactDetails({
    director: m.credits?.crew.find((c) => c.job === 'Director')?.name,
    cast: [...(m.credits?.cast ?? [])].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).slice(0, 4).map((c) => c.name),
    year: yearOf(m.release_date),
    runtimeMin: m.runtime || undefined,
    rating: m.vote_count && m.vote_count >= 20 && m.vote_average ? Math.round(m.vote_average * 10) / 10 : undefined,
  });

export const gameDetails = (g: {
  released?: string | null;
  metacritic?: number | null;
  developers?: { name: string }[];
  publishers?: { name: string }[];
  platforms?: { platform: { name: string } }[];
}): ItemDetails =>
  compactDetails({
    developers: g.developers?.slice(0, 3).map((d) => d.name),
    publishers: g.publishers?.slice(0, 3).map((d) => d.name),
    released: g.released || undefined,
    year: yearOf(g.released),
    metacritic: g.metacritic || undefined,
    platforms: g.platforms?.map((p) => p.platform.name).slice(0, 8),
  });

export const bookDetails = (d: {
  author_name?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  subject?: string[];
}): ItemDetails =>
  compactDetails({
    authors: d.author_name?.slice(0, 3),
    year: d.first_publish_year,
    pages: d.number_of_pages_median,
    subjects: d.subject?.filter((s) => s.length <= 30).slice(0, 5),
  });
