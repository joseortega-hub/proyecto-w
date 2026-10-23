/**
 * Un dominio = adaptador de importación + esta configuración. El motor de entrevista
 * y el ranking solo leen de aquí; no saben si los elementos son canciones o películas.
 */
export interface DomainAttribute {
  key: string;
  label: string;
  kind: 'scale' | 'tags';
  description: string;
  lowLabel?: string;
  highLabel?: string;
}

/** Un grupo de etiquetas por el que la entrevista puede preguntar (p. ej. "urbano"). */
export interface TagGroup {
  key: string;
  label: string;
  tags: string[];
}

/**
 * Una sonda es una pregunta posible, todavía sin redactar: qué quiere averiguar
 * y qué atributos informa. Gemini la redacta según el contexto de la entrevista.
 */
export interface Probe {
  id: string;
  intent: string;
  /** Atributos de escala o grupos de etiquetas que informa esta pregunta. */
  informs: string[];
  yesChip: string;
  noChip: string;
}

/** Ajustes rápidos de la pantalla de resultado ("+ energía", "con voz"…). */
export interface Refinement {
  key: string;
  label: string;
  attribute: string;
  delta: number;
}

/**
 * Preferencia previa: un filtro duro que se elige antes de la entrevista (p. ej. el
 * idioma de la letra). No es ánimo: se aplica en la búsqueda, no en el perfil.
 */
export interface Preference {
  /** Clave en `items.facets`. */
  key: string;
  label: string;
  options: {
    value: string;
    label: string;
    /** Cómo se dice en un aviso: "en español". */
    phrase?: string;
  }[];
  /** Opción que no filtra ("Me da igual"). */
  anyValue: string;
  /** Valores del elemento que pasan siempre el filtro (p. ej. las instrumentales). */
  alwaysPass: string[];
  /** Cómo se llaman los elementos que completan la lista si faltan ("instrumentales"). */
  fillerLabel: string;
  /** Qué se pregunta al DecisionProvider para preseleccionar la opción a partir del texto inicial. */
  guessInstructions: string;
}

export interface DomainConfig {
  /** Cómo se habla del catálogo en los textos generados. */
  voice: string;
  attributes: DomainAttribute[];
  tagGroups: TagGroup[];
  probes: Probe[];
  refinements: Refinement[];
  /** Preferencias previas (filtros duros) que se eligen al empezar. */
  preferences?: Preference[];
  interview: { minQuestions: number; maxQuestions: number; confidenceToFinish: number };
  result: { candidates: number; judged: number; size: number };
}

export interface DomainDefinition {
  id: string;
  name: string;
  /** Sustantivo para un elemento en singular y plural ("canción", "canciones"). */
  itemNoun: string;
  itemNounPlural: string;
  config: DomainConfig;
}
