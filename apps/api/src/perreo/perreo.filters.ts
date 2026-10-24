/** Resumen de un artista para el explorador (sin foto ni biografía). */
export interface ArtistSummary {
  slug: string;
  name: string;
  country: string | null;
  city: string | null;
  countries: string[];
  debutYear: number | null;
  fame: number;
  styles: string[];
  labels: string[];
  /** La persona lo sigue en Instagram. */
  followed: boolean;
}

export type ArtistSort = 'fame' | 'age' | 'name';

export interface ArtistQuery {
  q?: string;
  sort?: ArtistSort;
  /** Fama mínima y máxima, 0–100 (deslizador de «underground» a «mainstream»). */
  fameMin?: number;
  fameMax?: number;
  country?: string;
  city?: string;
  era?: string;
  label?: string;
  style?: string;
  /** Solo los que la persona sigue en Instagram. */
  followed?: boolean;
}

/** Épocas por año de debut. */
export const ERAS = [
  { id: 'old-school', label: 'Old school (antes de 2005)', from: 0, to: 2004 },
  { id: '2005-2014', label: 'Años 2005–2014', from: 2005, to: 2014 },
  { id: '2015-2019', label: 'Años 2015–2019', from: 2015, to: 2019 },
  { id: '2020', label: 'Desde 2020', from: 2020, to: 9999 },
] as const;

export const eraOf = (debutYear: number | null) => (debutYear == null ? null : ERAS.find((e) => debutYear >= e.from && debutYear <= e.to)!.id);

/** Minúsculas y sin tildes, para comparar nombres. */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/** Ciudades de un texto como «San Juan / Filadelfia, Pensilvania» → San Juan, Filadelfia. */
export const cityParts = (city: string | null): string[] =>
  (city ?? '')
    .split('/')
    .map((c) => c.split(',')[0].trim())
    .filter(Boolean);

/** Filtros combinables (todos a la vez) y orden. */
export function filterArtists(list: ArtistSummary[], query: ArtistQuery): ArtistSummary[] {
  const q = query.q ? fold(query.q) : '';
  const out = list.filter((a) => {
    if (q && !fold(a.name).includes(q)) return false;
    if (query.followed && !a.followed) return false;
    if (query.fameMin != null && a.fame < query.fameMin) return false;
    if (query.fameMax != null && a.fame > query.fameMax) return false;
    if (query.country && !a.countries.some((c) => fold(c) === fold(query.country!))) return false;
    if (query.city && !cityParts(a.city).some((c) => fold(c) === fold(query.city!))) return false;
    if (query.era && eraOf(a.debutYear) !== query.era) return false;
    if (query.label && !a.labels.some((l) => fold(l) === fold(query.label!))) return false;
    if (query.style && !a.styles.includes(query.style)) return false;
    return true;
  });
  const sort = query.sort ?? 'fame';
  return out.sort((a, b) =>
    sort === 'name'
      ? a.name.localeCompare(b.name, 'es')
      : sort === 'age'
        ? (a.debutYear ?? 9999) - (b.debutYear ?? 9999) || a.name.localeCompare(b.name, 'es')
        : b.fame - a.fame || a.name.localeCompare(b.name, 'es'),
  );
}

export interface ArtistFacets {
  countries: { value: string; count: number }[];
  cities: { value: string; count: number }[];
  eras: { value: string; label: string; count: number }[];
  labels: { value: string; count: number }[];
  styles: { value: string; count: number }[];
}

const tally = (values: string[]) => {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'es'));
};

/** Opciones de cada filtro con cuántos artistas tiene (sobre toda la lista, para que los chips no bailen). */
export function artistFacets(list: ArtistSummary[]): ArtistFacets {
  return {
    countries: tally(list.flatMap((a) => a.countries)),
    cities: tally(list.flatMap((a) => cityParts(a.city))).filter((c) => c.count >= 2),
    eras: ERAS.map((e) => ({ value: e.id, label: e.label, count: list.filter((a) => eraOf(a.debutYear) === e.id).length })).filter((e) => e.count > 0),
    labels: tally(list.flatMap((a) => a.labels)),
    styles: tally(list.flatMap((a) => a.styles)),
  };
}
