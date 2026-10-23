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
  summary: string[];
}

export interface ResultEntry {
  itemId: string;
  match: number;
  reason: string;
}

export interface SessionResult {
  title: string;
  entries: ResultEntry[];
  candidates: number;
  catalogSize: number;
  refinements: string[];
  createdAt: string;
}
