// Entender contra el catálogo: antes de llamar a la IA se busca el texto entre las entidades
// REALES del catálogo (títulos, creadores, compañías, colecciones, etiquetas). La IA elige entre
// ellas en vez de inventar términos, y lo elegido se convierte en condiciones exactas sobre los
// datos estructurados (`facets`), no en texto que buscar. Lógica pura, sin IA ni base de datos.
import type { DomainConfig } from '../domains/domain.types.js';
import { normalize } from './interview.engine.js';
import type { Anchor, AnchorCondition } from './interview.types.js';

/** Facetas estructuradas que se pueden pedir por su nombre ("Marvel Studios", "Harry Potter - Colección"). */
export const ENTITY_FACETS = ['companies', 'collection', 'series'] as const;

export interface MatchableItem {
  id: string;
  title: string;
  subtitle: string | null;
  tags: string[];
  facets?: Record<string, string | string[]>;
}

/** Una entidad del catálogo que el texto menciona. */
export interface Entity {
  /** Id corto para la IA ("e1"). */
  id: string;
  kind: Anchor['kind'];
  /** Cómo se llama en el catálogo ("Marvel Studios", "Alas de Sangre"). */
  name: string;
  /** Lo que dijo la persona y casó, normalizado ("pokemon"). */
  said: string;
  /** Lo mismo tal y como lo escribió ("Pokémon"), para los textos. */
  written: string;
  condition: AnchorCondition;
  /** Cuántos elementos del catálogo la cumplen. */
  count: number;
  /** Elementos que la cumplen (solo se guardan en los títulos: son pocos). */
  ids: string[];
}

const STOP = new Set(
  ('a al algo alguna alguno algun ahora como con cual cuando de del desde donde e el ella en es esa ese esta este eso esto estoy ' +
    'hay hoy la las le lo los me mi mis muy no ni nada o otra otro para pero poco por pon ponme que quiero quieres se sea ser si sin ' +
    'su sus tal te tipo tu un una uno unos unas y ya yo apetece apetecen busco dame lista libros libro peliculas pelicula cancion ' +
    'canciones juego juegos videojuego videojuegos musica parecido parecida parecidos parecidas similar similares rollo estilo ' +
    'sabe se se que se el que mas menos bien mal bueno buena nuevo nueva the of and').split(' '),
);
/** Palabras genéricas de los nombres de compañías y colecciones: solas no identifican a nadie. */
const GENERIC = new Set(
  'studios studio pictures picture entertainment games game films film company inc ltd llc productions production interactive animation media group co corporation collection coleccion saga serie series the de la el los las and'.split(' '),
);
/** Antes de una mención, indican que la persona la quiere fuera ("nada de terror"). */
const NEGATION = /(nada de|sin|no quiero|ni|odio|excepto|menos)\s+$/;
/** Antes de una mención, indican que es una referencia de estilo, no un filtro ("tipo Marvel"). */
const LIKE = /(tipo|como|estilo|parecid[oa]s? a|rollo|al estilo de)\s+$/;

const clean = (s: string) => normalize(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const wordsOf = (s: string) => clean(s).split(' ').filter(Boolean);
const meaningful = (phrase: string[]) => phrase.length > 0 && !STOP.has(phrase[0]) && !STOP.has(phrase[phrase.length - 1]) && phrase.join(' ').length >= 4;

/** Si un texto contiene la frase como palabras completas. */
export const hasPhrase = (text: string, phrase: string) => ` ${clean(text)} `.includes(` ${clean(phrase)} `);

const facetValues = (item: MatchableItem, key: string) => [item.facets?.[key] ?? []].flat().map(clean);

/** Si el elemento cumple la condición (todas las comparaciones, sin tildes ni mayúsculas). */
export function meets(item: MatchableItem, c: AnchorCondition): boolean {
  const values = c.values.map(clean).filter(Boolean);
  switch (c.field) {
    case 'id':
      return c.values.includes(item.id);
    case 'title':
      return values.some((v) => hasPhrase(item.title, v));
    case 'creator':
      return values.some((v) => (item.subtitle ?? '').split(/,\s*/).some((name) => clean(name) === v || (v.length >= 6 && hasPhrase(name, v))));
    case 'tags':
      return item.tags.some((t) => values.includes(clean(t)));
    default:
      return facetValues(item, c.field).some((f) => values.some((v) => f === v || hasPhrase(f, v)));
  }
}

/** Si el elemento cumple alguna de las condiciones de un ancla estructurada. */
export const meetsAny = (item: MatchableItem, conditions: AnchorCondition[]) => conditions.some((c) => meets(item, c));

/** Etiquetas de géneros del dominio (las de `tagGroups`): el vocabulario cerrado para la IA. */
export const genreVocabulary = (config: DomainConfig) => [...new Set(config.tagGroups.flatMap((g) => g.tags))];

/** Raíz corta para casar "romántico" con "romance" o "fantasía" con "fantasy". */
const stem = (w: string) => (w.length >= 5 ? w.slice(0, 5) : null);

interface IndexEntry {
  kind: Anchor['kind'];
  name: string;
  condition: AnchorCondition;
  ids: Set<string>;
}

/** Índice frase → entidades del catálogo. Se construye en memoria (catálogos de cientos de elementos). */
export function entityIndex(catalog: MatchableItem[], config: DomainConfig, { titleFamilies = true } = {}) {
  const index = new Map<string, Map<string, IndexEntry>>();
  const add = (phrase: string, kind: Anchor['kind'], name: string, condition: AnchorCondition, id: string) => {
    const key = `${condition.field}:${condition.values[0]}`;
    let byKey = index.get(phrase);
    if (!byKey) index.set(phrase, (byKey = new Map()));
    let entry = byKey.get(key);
    if (!entry) byKey.set(key, (entry = { kind, name, condition, ids: new Set() }));
    entry.ids.add(id);
  };
  /** Frases de un nombre sin las palabras genéricas ("marvel studios" → "marvel studios", "marvel"). */
  const subphrases = (name: string) => {
    const w = wordsOf(name);
    const out = new Set<string>([w.join(' ')]);
    for (let i = 0; i < w.length; i++)
      for (let j = i + 1; j <= Math.min(w.length, i + 4); j++) {
        const part = w.slice(i, j);
        if (part.every((x) => GENERIC.has(x) || STOP.has(x))) continue;
        if (GENERIC.has(part[0]) || GENERIC.has(part[part.length - 1]) || !meaningful(part)) continue;
        out.add(part.join(' '));
      }
    return out;
  };

  const familyCount = new Map<string, Set<string>>();
  for (const it of catalog) {
    const title = wordsOf(it.title).join(' ');
    if (title.length >= 3) add(title, 'title', it.title, { field: 'id', values: [it.id] }, it.id);
    // Título antes de los dos puntos ("Thor: el mundo oscuro" → "thor"): también nombra la obra.
    const head = it.title.split(/[:(–—-]/)[0];
    if (head !== it.title && clean(head).length >= 4) add(clean(head), 'title', it.title, { field: 'id', values: [it.id] }, it.id);
    if (titleFamilies) {
      const w = wordsOf(it.title);
      for (let i = 0; i < w.length; i++)
        for (let j = i + 1; j <= Math.min(w.length, i + 3); j++) {
          const part = w.slice(i, j);
          if (!meaningful(part) || part.join(' ').length < 5) continue;
          const phrase = part.join(' ');
          if (!familyCount.has(phrase)) familyCount.set(phrase, new Set());
          familyCount.get(phrase)!.add(it.id);
        }
    }
    for (const name of (it.subtitle ?? '').split(/,\s*/).filter(Boolean)) {
      const full = clean(name);
      if (full.length < 3) continue;
      add(full, 'creator', name, { field: 'creator', values: [full] }, it.id);
      const parts = full.split(' ');
      const last = parts[parts.length - 1];
      if (parts.length >= 2 && last.length >= 6 && !STOP.has(last)) add(last, 'creator', name, { field: 'creator', values: [full] }, it.id);
    }
    for (const key of ENTITY_FACETS) {
      for (const raw of [it.facets?.[key] ?? []].flat()) {
        const kind = key === 'companies' ? 'studio' : 'franchise';
        for (const phrase of subphrases(raw)) add(phrase, kind, raw, { field: key, values: [clean(raw)] }, it.id);
      }
    }
    for (const tag of it.tags) {
      const t = clean(tag);
      if (t.length >= 4 && !STOP.has(t)) add(t, 'tag', tag, { field: 'tags', values: [t] }, it.id);
    }
  }
  // Familias de títulos: una frase que aparece en 3 o más títulos es una saga ("pokemon", "harry potter").
  for (const [phrase, ids] of familyCount) {
    if (ids.size < 3) continue;
    for (const id of ids) add(phrase, 'franchise', phrase, { field: 'title', values: [phrase] }, id);
  }
  // Géneros por raíz, para casar el español de la persona con las etiquetas de la fuente.
  const stems = new Map<string, Set<string>>();
  for (const tag of genreVocabulary(config)) {
    const s = stem(clean(tag).split(' ')[0]);
    if (!s) continue;
    if (!stems.has(s)) stems.set(s, new Set());
    stems.get(s)!.add(clean(tag));
  }
  return { index, stems };
}

export type EntityIndex = ReturnType<typeof entityIndex>;

/**
 * Entidades del catálogo que menciona el texto, de la más concreta a la más vaga. Las negadas
 * ("nada de terror") no salen aquí: son exclusiones y se tratan aparte.
 */
export function findEntities(text: string, catalog: MatchableItem[], config: DomainConfig, built?: EntityIndex): Entity[] {
  const { index, stems } = built ?? entityIndex(catalog, config);
  // Una etiqueta que no es un género del dominio ("marvel", "superhero") nombra una saga o un tema concreto.
  const genres = new Set(genreVocabulary(config).map(clean));
  const tokens = wordsOf(text);
  // Las mismas palabras, como las escribió (mismos cortes: quitar tildes no cambia los límites).
  const raw = text.normalize('NFC').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const original = raw.length === tokens.length ? raw : tokens;
  const found = new Map<string, Entity & { span: number; at: number }>();
  const push = (entry: IndexEntry, said: string, span: number, at: number) => {
    const key = `${entry.condition.field}:${entry.condition.values[0]}`;
    const prev = found.get(key);
    if (prev && prev.span >= span) return;
    found.set(key, {
      id: '',
      kind: entry.kind === 'tag' && !genres.has(entry.condition.values[0]) ? 'franchise' : entry.kind,
      name: entry.name,
      said,
      written: original.slice(at, at + span).join(' '),
      condition: entry.condition,
      count: entry.ids.size,
      ids: entry.kind === 'title' ? [...entry.ids].slice(0, 5) : [],
      span,
      at,
    });
  };
  for (let i = 0; i < tokens.length; i++) {
    for (let j = Math.min(tokens.length, i + 6); j > i; j--) {
      const part = tokens.slice(i, j);
      if (!meaningful(part)) continue;
      const phrase = part.join(' ');
      for (const entry of index.get(phrase)?.values() ?? []) push(entry, phrase, part.length, i);
    }
    const s = stem(tokens[i]);
    const tags = s ? stems.get(s) : undefined;
    for (const tag of tags ?? []) {
      for (const entry of index.get(tag)?.values() ?? []) if (entry.condition.field === 'tags') push(entry, tokens[i], 1, i);
    }
  }
  const before = (at: number) => `${tokens.slice(Math.max(0, at - 3), at).join(' ')} `;
  // El nombre de una saga ("Pokémon") no es el título que empieza por él ("Pokémon: Let's Go").
  const sagas = new Set([...found.values()].filter((e) => e.kind !== 'title' && e.count > 1).map((e) => e.said));
  for (const [key, e] of found) if (e.kind === 'title' && sagas.has(e.said) && clean(e.name) !== e.said) found.delete(key);
  // Y al revés: si dijo un título exacto ("Alas de sangre"), sus otras ediciones no lo convierten en saga.
  const exact = new Set([...found.values()].filter((e) => e.kind === 'title' && clean(e.name) === e.said).map((e) => e.said));
  for (const [key, e] of found) if (e.condition.field === 'title' && exact.has(e.said)) found.delete(key);
  const rank = { title: 0, creator: 1, studio: 2, franchise: 2, tag: 3 } as const;
  return [...found.values()]
    .filter((e) => !NEGATION.test(before(e.at)))
    // Una frase que nombra un título entero no es además una saga de una sola palabra suelta.
    .sort((a, b) => b.span - a.span || rank[a.kind] - rank[b.kind] || b.count - a.count)
    .slice(0, 24)
    .map(({ span: _span, at: _at, ...e }, i) => ({ ...e, id: `e${i + 1}` }));
}

/** "Marvel y parecidos", "Pokémon o algo parecido": X entra en la lista (primero); "parecido a X", no. */
export function likeIncludesItself(text: string, label: string): boolean {
  const t = ` ${clean(text)} `;
  const x = clean(label);
  return new RegExp(` ${x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (y|o) (algo |cosas |otr[oa]s )?(parecid|similar)`).test(t);
}

/** Si la mención va precedida de "tipo", "como"… (referencia de estilo, no filtro). */
export function saidAsLike(text: string, said: string): boolean {
  const t = ` ${clean(text)} `;
  const at = t.indexOf(` ${said} `);
  return (at > 0 && LIKE.test(t.slice(0, at + 1).trim() + ' ')) || likeIncludesItself(text, said);
}

/** Clave de un título para no repetir ediciones ("Alas de sangre (Empíreo 1)" = "Alas de Sangre"; las secuelas con ":" no). */
export const titleKey = (title: string) => clean(title.split(/[([]/)[0]);

const pretty = (s: string) => s.replace(/(^|\s)(\p{L})/gu, (_m, space: string, c: string) => space + c.toUpperCase());

/**
 * Anclas a partir de las entidades elegidas: las del mismo nombre dicho ("marvel" → compañía
 * Marvel Studios + etiqueta marvel) se juntan en una sola con varias condiciones (vale cualquiera).
 * Los títulos son semillas: van primero en la lista y el resto se parece a ellos.
 */
export function anchorsFromEntities(entities: Entity[], uses: Map<string, 'only' | 'include' | 'like'>): Anchor[] {
  const out: Anchor[] = [];
  const byLabel = new Map<string, Anchor>();
  for (const e of entities) {
    const use = uses.get(e.id);
    if (!use) continue;
    if (e.kind === 'title') {
      if (out.some((a) => a.kind === 'title' && a.ids?.includes(e.ids[0]))) continue;
      out.push({ label: e.name, kind: 'title', terms: [e.name], required: true, ids: e.ids.slice(0, 1), match: [{ field: 'id', values: e.ids.slice(0, 1) }] });
      continue;
    }
    const label = e.kind === 'creator' ? e.name : pretty(e.written);
    const key = `${normalize(e.said)}|${use}`;
    const prev = byLabel.get(key);
    if (prev) {
      if (!prev.match!.some((c) => c.field === e.condition.field && c.values[0] === e.condition.values[0])) prev.match!.push(e.condition);
      if (prev.kind === 'tag' && e.kind !== 'tag') prev.kind = e.kind;
      continue;
    }
    const anchor: Anchor = { label, kind: e.kind, terms: [e.said, e.name].filter((t, i, all) => all.indexOf(t) === i), required: use === 'only', match: [e.condition] };
    byLabel.set(key, anchor);
    out.push(anchor);
  }
  // Una etiqueta suelta ("pokemon" en Smash Bros.) no cuenta si hay algo más exacto (saga, compañía…).
  for (const a of out) {
    const strong = a.match?.filter((c) => c.field !== 'tags') ?? [];
    if (a.kind !== 'tag' && strong.length) a.match = strong;
  }
  return out.slice(0, 3);
}

/**
 * Elección sin IA (respaldo): los títulos dichos enteros son semillas; los creadores,
 * compañías, colecciones, sagas y etiquetas son filtros (o referencias si van tras "tipo").
 * De las sagas sacadas de títulos sueltos y las etiquetas, solo las que el texto nombra
 * con claridad (al menos 4 letras y no son la única palabra de otra entidad más concreta).
 */
export function pickWithoutAI(text: string, entities: Entity[]): Map<string, 'only' | 'include' | 'like'> {
  const uses = new Map<string, 'only' | 'include' | 'like'>();
  const covered: string[] = [];
  for (const e of entities) {
    if (covered.some((c) => ` ${c} `.includes(` ${e.said} `) && c !== e.said)) continue;
    if (e.kind === 'title') {
      // Un título de una sola palabra casa con demasiadas cosas ("Coco", "Up"): solo si es largo.
      if (e.said.split(' ').length < 2 && e.said.length < 7) continue;
      uses.set(e.id, 'include');
    } else {
      uses.set(e.id, saidAsLike(text, e.said) ? 'like' : 'only');
    }
    covered.push(e.said);
  }
  return uses;
}
