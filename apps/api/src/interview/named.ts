// Nombres propios pedidos de forma explícita ("libros de la autora Sarah J. Maas", "películas del
// director Nolan", "juegos de Nintendo"). Detección por patrones y resolución con tolerancia a
// erratas contra las entidades del catálogo. Lógica pura: sin IA, sin base de datos y sin red.
import type { DomainConfig } from '../domains/domain.types.js';
import { entityIndex, type EntityIndex, type MatchableItem } from './catalog-match.js';
import { normalize } from './interview.engine.js';
import type { Anchor, AnchorCondition } from './interview.types.js';

/** Qué tipo de nombre se espera tras el patrón: una persona, una compañía, una saga o cualquiera. */
export type NamedRole = 'person' | 'company' | 'saga' | 'any';

export interface Mention {
  /** El nombre tal cual lo escribió ("saran j maas"). */
  name: string;
  role: NamedRole;
  /** El texto sin la mención, para que la IA entienda solo el resto. */
  rest: string;
}

/** Fin del nombre: conectores y palabras de lo que viene después. */
const END = '(?=\\s+(?:y|e|o|que|pero|para|con|sin|algo|quiero|muy|tipo|como|donde|cuando|porque|por|en|nada|ni|mas|menos|tranquil\\w*|divertid\\w*|corto|cortos|largo|largos)\\b|[,.;:!?]|$)';
const NAME = "([\\p{L}\\p{N}][\\p{L}\\p{N}.'’&-]*(?:\\s+[\\p{L}\\p{N}][\\p{L}\\p{N}.'’&-]*){0,4}?)";

interface Pattern {
  re: RegExp;
  role: NamedRole;
  domains?: string[];
}

const make = (lead: string, role: NamedRole, domains?: string[]): Pattern => ({ re: new RegExp(`(?:^|\\s)(${lead})\\s+(?:(?:el|la|los|las|un|una)\\s+)?${NAME}${END}`, 'iu'), role, domains });

/** Los más concretos primero: el primero que casa gana. */
const PATTERNS: Pattern[] = [
  make('(?:de la|de el|del)? ?autor(?:a)?(?: llamad[oa])?|escrit[oa]s? por|libros? escritos por|escritor(?:a)?', 'person', ['books']),
  make('(?:de la|de el|del)? ?director(?:a)?|dirigid[oa]s? por|dirigida|pel[ií]culas? (?:de|dirigidas por)|pelis? de', 'person', ['movies']),
  make('con|protagonizad[oa]s? por|actor|actriz|con el actor|con la actriz', 'person', ['movies']),
  make('(?:de la|de el|del)? ?(?:saga|franquicia|universo|serie)(?: de)?|(?:la|el) (?:saga|franquicia|universo)', 'saga'),
  make('(?:de la|de el|del)? ?(?:editorial|editora)|(?:de la|de el|del)? ?(?:estudio|productora|desarrolladora|distribuidora|compa[nñ]ia)', 'company'),
  make('juegos? (?:de|del)|videojuegos? (?:de|del)', 'any', ['games']),
  make('pel[ií]culas? (?:de|del)|pelis? (?:de|del)|cine de', 'any', ['movies']),
  make('libros? (?:de|del)|novelas? (?:de|del)', 'any', ['books']),
];

/** Palabras que, solas, no son un nombre ("libros de aventuras", "películas de miedo"). */
const NOT_NAMES = new Set(
  ('terror miedo amor aventuras aventura accion romance romantico romantica comedia fantasia ciencia ficcion drama suspense misterio historia historias ' +
    'guerra cine nada algo siempre antes hoy ayer casa vida hombres mujeres chicos chicas ninos ninas verano invierno navidad dragones magia reir llorar ' +
    'algo mucho mucha poco poca ganas gente amigos mi mis tu tus alguien otros otras todo toda animacion animados superheroes zombies vampiros fantasmas deportes carreras coches futbol musica').split(' '),
);

/** Menciones explícitas de nombres en el texto (como mucho 2), de la más concreta a la más vaga. */
export function detectMentions(text: string, domainId: string): Mention[] {
  const out: Mention[] = [];
  let rest = text;
  for (const p of PATTERNS) {
    if (p.domains && !p.domains.includes(domainId)) continue;
    const m = p.re.exec(rest);
    if (!m) continue;
    const name = m[2].trim().replace(/[.,;:]+$/, '');
    const key = normalize(name);
    if (key.length < 3 || NOT_NAMES.has(key.split(' ')[0]) || key.split(' ').every((w) => NOT_NAMES.has(w))) continue;
    out.push({ name, role: p.role, rest: '' });
    rest = `${rest.slice(0, m.index)} ${rest.slice(m.index + m[0].length)}`.replace(/\s+/g, ' ').trim();
    if (out.length === 2) break;
  }
  return out.map((m) => ({ ...m, rest }));
}

/** Trigramas de una palabra o frase, con relleno para que cuenten también el principio y el final. */
const grams = (s: string) => {
  const t = `  ${normalize(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
  const out = new Map<string, number>();
  for (let i = 0; i + 3 <= t.length; i++) out.set(t.slice(i, i + 3), (out.get(t.slice(i, i + 3)) ?? 0) + 1);
  return out;
};
const dice = (a: string, b: string) => {
  const x = grams(a);
  const y = grams(b);
  let shared = 0;
  let total = 0;
  for (const [g, n] of x) shared += Math.min(n, y.get(g) ?? 0), (total += n);
  for (const n of y.values()) total += n;
  return total ? (2 * shared) / total : 0;
};

/**
 * Parecido entre lo escrito y un nombre (0–1): trigramas del nombre entero o de cualquier tramo
 * del mismo largo ("nolan" ~ "Christopher Nolan"; "saran j maas" ~ "Sarah J. Maas"). Un tramo
 * suelto vale algo menos que el nombre entero.
 */
export function similarity(written: string, name: string): number {
  const w = normalize(written).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const words = normalize(name).replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ');
  const size = w.split(' ').length;
  let best = dice(w, words.join(' '));
  if (words.length > size) for (let i = 0; i + size <= words.length; i++) best = Math.max(best, 0.95 * dice(w, words.slice(i, i + size).join(' ')));
  return best;
}

/** Por debajo de esto, no se acepta como el mismo nombre. */
export const MIN_SIMILARITY = 0.62;

export interface Resolved {
  /** Cómo se llama en el catálogo o en la fuente ("Sarah J. Maas"). */
  name: string;
  kind: Anchor['kind'];
  conditions: AnchorCondition[];
  /** Cuántos elementos del catálogo la cumplen. */
  count: number;
  similarity: number;
}

const KIND_OF: Record<NamedRole, Anchor['kind'][]> = {
  person: ['creator'],
  company: ['studio', 'franchise'],
  saga: ['franchise', 'studio'],
  any: ['creator', 'studio', 'franchise'],
};

/**
 * Busca el nombre entre los creadores, compañías, colecciones y sagas del catálogo, tolerando
 * erratas. Gana el más parecido; a igualdad, el que tiene más elementos y el que encaja con el rol.
 */
export function resolveName(mention: Pick<Mention, 'name' | 'role'>, catalog: MatchableItem[], config: DomainConfig, built?: EntityIndex): Resolved | null {
  const { index } = built ?? entityIndex(catalog, config);
  const wanted = KIND_OF[mention.role];
  let best: (Resolved & { rank: number }) | null = null;
  for (const [phrase, entries] of index) {
    const s = similarity(mention.name, phrase);
    if (s < MIN_SIMILARITY) continue;
    // Un comienzo del nombre escrito ("zeld" para «zelda») es otra cosa, no una errata.
    if (s < 1 && normalize(mention.name).startsWith(normalize(phrase))) continue;
    for (const e of entries.values()) {
      // Un título suelto o un género no son un nombre propio; una saga sí (título que se repite).
      if (!wanted.includes(e.kind) || e.condition.field === 'id') continue;
      const rank = wanted.indexOf(e.kind);
      const better = !best || s > best.similarity + 0.02 || (Math.abs(s - best.similarity) <= 0.02 && (rank < best.rank || (rank === best.rank && e.ids.size > best.count)));
      if (better) best = { name: e.name, kind: e.kind, conditions: [e.condition], count: e.ids.size, similarity: s, rank };
    }
  }
  if (!best) return null;
  // Todas las entidades con el mismo nombre (compañía y colección "Marvel") valen: vale cualquiera.
  const conditions: AnchorCondition[] = [];
  const same = normalize(best.name);
  let count = 0;
  const ids = new Set<string>();
  for (const entries of index.values())
    for (const e of entries.values())
      if (wanted.includes(e.kind) && e.condition.field !== 'id' && normalize(e.name) === same && !conditions.some((c) => c.field === e.condition.field && c.values[0] === e.condition.values[0])) {
        conditions.push(e.condition);
        for (const id of e.ids) ids.add(id);
      }
  count = ids.size || best.count;
  return { name: best.name, kind: best.kind, conditions: conditions.length ? conditions : best.conditions, count, similarity: best.similarity };
}

/** El candidato más parecido a lo escrito (a igualdad, el primero: las fuentes ya vienen por relevancia). */
export function bestName<T extends { name: string }>(written: string, candidates: T[]): { candidate: T; similarity: number } | null {
  let best: { candidate: T; similarity: number } | null = null;
  for (const candidate of candidates) {
    const s = similarity(written, candidate.name);
    if (s >= MIN_SIMILARITY && (!best || s > best.similarity + 0.02)) best = { candidate, similarity: s };
  }
  return best;
}

/** Consultas para encontrar un nombre con errata en una búsqueda exacta: el nombre, cada palabra y su comienzo. */
export function nameQueries(name: string): string[] {
  const words = normalize(name).replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter((w) => w.length >= 2);
  const out = new Set<string>([words.join(' ')]);
  for (const w of [...words].sort((a, b) => b.length - a.length)) {
    out.add(w);
    if (w.length >= 5) out.add(`${w.slice(0, 5)}*`);
  }
  return [...out].slice(0, 6);
}
