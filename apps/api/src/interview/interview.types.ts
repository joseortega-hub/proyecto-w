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
}
