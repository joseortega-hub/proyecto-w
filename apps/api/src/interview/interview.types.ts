export type Answer = 'yes' | 'no' | 'unknown';

/** Un turno de la entrevista. `answer` es null mientras la pregunta está pendiente. */
export interface InterviewTurn {
  probeId: string;
  text: string;
  reason: string;
  answer: Answer | null;
}

export interface MoodProfile {
  /** Valor 0–1 por atributo de escala. */
  scales: Record<string, number>;
  /** Probabilidad 0–1 de que le apetezca cada grupo de etiquetas. */
  tagGroups: Record<string, number>;
  /** Atributos sobre los que la entrevista dio información. */
  informed: string[];
  /** Confianza 0–1 por dimensión: la entrevista podrá preguntar solo por las dudosas. */
  confidence: Record<string, number>;
  summary: string[];
}

export interface ResultEntry {
  itemId: string;
  /** Encaje mostrado, 0–100: parecido por atributos + probabilidad de encaje. */
  match: number;
  /** Probabilidad de encaje (0–1) según el DecisionProvider (`noul`). */
  fit: number | null;
  reason: string;
}

/** Preferencia previa por clave: valor elegido, quién lo eligió y con qué confianza. */
export type SessionPreferences = Record<string, { value: string; source: 'user' | 'guess'; confidence: number | null }>;

export interface SessionResult {
  title: string;
  /** Aviso para la persona cuando un filtro deja pocos elementos (p. ej. pocas en español). */
  notice?: string | null;
  entries: ResultEntry[];
  candidates: number;
  catalogSize: number;
  refinements: string[];
  createdAt: string;
  /** Lista creada en la cuenta de YouTube de la persona a partir de este resultado. */
  youtube?: { playlistId: string; url: string } | null;
}

/**
 * Lo que el texto inicial ya deja claro, por atributo de escala: nivel (0–1) y confianza.
 * Solo se guardan las señales confiadas; la entrevista no pregunta por esas dimensiones.
 */
export type TextSignals = Record<string, { value: number; confidence: number }>;

/**
 * Algo concreto que la persona pidió en su texto inicial ("algo de Marvel", "Pokémon",
 * "Brandon Sanderson", "dembow"). Se guarda en la sesión en vez del texto en bruto, así
 * que sobrevive a los reajustes y no compromete la privacidad.
 */
export interface Anchor {
  /** Cómo lo dijo la persona, para los textos ("Marvel"). */
  label: string;
  kind: 'franchise' | 'creator' | 'studio' | 'title' | 'tag';
  /** Términos para encontrarlo en el catálogo (título, creador, etiquetas, descripción). */
  terms: string[];
  /** Si lo pide de forma explícita ("algo de Marvel") o es solo una referencia ("tipo Marvel"). */
  required: boolean;
}
