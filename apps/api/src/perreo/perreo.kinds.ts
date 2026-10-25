// Tipos de cuenta de Instagram del Modo Perreo: quién es cada seguido (artista, productor, sello…).
import { fold } from './perreo.filters.js';

export const KINDS = ['artist', 'group', 'producer', 'dj', 'label', 'composer', 'media', 'agency', 'other', 'unclassified'] as const;
export type Kind = (typeof KINDS)[number];

/** Nombre en plural para los filtros y el contador. */
export const KIND_LABELS: Record<Kind, string> = {
  artist: 'artistas',
  group: 'dúos y grupos',
  producer: 'productores',
  dj: 'DJs',
  label: 'sellos',
  composer: 'compositores',
  media: 'medios',
  agency: 'mánagers y agencias',
  other: 'otros',
  unclassified: 'sin clasificar',
};

/** Solo los artistas y grupos llevan canciones. */
export const hasSongs = (kind: Kind) => kind === 'artist' || kind === 'group';

/** Pistas del propio usuario: «lostrapperrecords», «dj.pepe», «beatsbyx», «radio…». Sin pistas, sin clasificar. */
export function kindFromUsername(username: string): Kind {
  const u = fold(username).replace(/[^a-z0-9]/g, '');
  if (/records|recordz|label|entertainment|ent$|musicgroup|discografica|sellodiscografico/.test(u)) return 'label';
  if (/^dj|dj$|deejay/.test(u)) return 'dj';
  if (/prod$|producer|productor|beats|beatmaker|^prod|studios?$|estudio/.test(u)) return 'producer';
  if (/radio|magazine|revista|podcast|tv$|^tv|news|noticias|media|fm$|show$/.test(u)) return 'media';
  if (/management|mgmt|manager|booking|agency|agencia|talent/.test(u)) return 'agency';
  return 'unclassified';
}

/** Ocupaciones («occupation», P106) y clases («instancia de», P31) de Wikidata → tipo. */
const OCCUPATION: Record<string, Kind> = {
  Q177220: 'artist', Q639669: 'artist', Q2252262: 'artist', Q488205: 'artist', Q55960555: 'artist',
  Q183945: 'producer', Q130857: 'dj', Q36834: 'composer', Q753110: 'composer',
};
const INSTANCE: Record<string, Kind> = {
  Q215380: 'group', Q2088357: 'group', Q10648343: 'group', Q5741069: 'group', Q56816954: 'group',
  Q18127: 'label', Q1762059: 'label', Q18127999: 'label',
  Q14350: 'media', Q1555508: 'media', Q41298: 'media', Q1002697: 'media', Q15416: 'media', Q5398426: 'media',
  Q4830453: 'agency', Q3661265: 'agency',
};
const PRIORITY: Kind[] = ['label', 'group', 'dj', 'producer', 'artist', 'composer', 'media', 'agency'];

/** Elige el tipo más específico entre las ocupaciones y clases del elemento. */
export function kindFromWikidata(occupations: string[], instances: string[]): Kind {
  const kinds = new Set<Kind>([...instances.map((i) => INSTANCE[i]), ...occupations.map((o) => OCCUPATION[o])].filter((k): k is Kind => !!k));
  // Un cantante que también produce sigue siendo artista: gana el artista salvo que sea solo productor o DJ.
  if (kinds.has('artist') && !kinds.has('group') && !kinds.has('label')) return 'artist';
  return PRIORITY.find((k) => kinds.has(k)) ?? 'other';
}

/** Tipo de MusicBrainz: Person → artista, Group → grupo. */
export const kindFromMusicBrainz = (type: string | null | undefined): Kind => (type === 'Group' ? 'group' : 'artist');
