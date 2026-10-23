/**
 * Cliente de la API REST de Sintonía (`apps/api`). El servidor MCP no toca la base de
 * datos ni los modelos: todo pasa por la API, con las mismas cadenas de IA y cupos.
 */

export type Answer = 'yes' | 'no' | 'unknown';

export interface Domain {
  id: string;
  name: string;
  itemNoun: string;
  itemNounPlural: string;
  itemCount: number;
  gender: 'm' | 'f';
  verb: string;
  creatorLabel: string;
  playable: boolean;
  source: { name: string; url: string; attribution: string };
  tagGroups: { key: string; label: string; tags: string[] }[];
  refinements: { key: string; label: string }[];
  preferences: { key: string; label: string; options: { value: string; label: string }[]; anyValue: string }[];
}

export interface Item {
  id: string;
  domainId: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  mediaUrl: string | null;
  externalUrl: string | null;
  durationSec: number | null;
  attributes: Record<string, number>;
  tags: string[];
  facets: Record<string, string | string[]>;
}

export interface SessionView {
  id: string;
  domainId: string;
  status: 'asking' | 'ready' | 'done';
  step: number;
  minQuestions: number;
  maxQuestions: number;
  confidence: number;
  chips: string[];
  question: { text: string; reason: string } | null;
  fromText: string[];
  taste: string[];
  context: { franja?: string; diaSemana?: string; tiempo?: { descripcion?: string; temperaturaC?: number } | null };
}

export interface AutoAnswer {
  question: string;
  answer: Answer;
  confidence: number | null;
  session: SessionView;
}

export interface ResultEntry {
  match: number;
  fit: number | null;
  reason: string;
  likes: string[];
  item: Item;
}

export interface SessionResult {
  id: string;
  domainId: string;
  title: string;
  answeredCount: number;
  chips: string[];
  notice: string | null;
  candidates: number;
  catalogSize: number;
  appliedRefinements: string[];
  refinements: { key: string; label: string }[];
  preferences: Record<string, { value: string; source: 'user' | 'guess' }> | null;
  entries: ResultEntry[];
}

export interface TasteLabel {
  id: string;
  label: string;
}

export interface Taste {
  domainId: string;
  onboarded: boolean;
  likes: TasteLabel[];
  dislikes: TasteLabel[];
  learned: (TasteLabel & { weight: number })[];
  preferences: Record<string, string>;
  vocabulary: { groups: TasteLabel[]; tags: TasteLabel[] };
}

export type TuningEvent =
  | { step: 'profile' }
  | { step: 'candidates'; count: number; total: number }
  | { step: 'fit'; checked: number; total: number }
  | { step: 'explain' }
  | { step: 'done'; sessionId: string }
  | { step: 'error'; message: string };

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface ApiOptions {
  /** Raíz de la API, con `/api` (p. ej. `http://localhost:3001/api`). */
  baseUrl: string;
  /** Persona anónima fija del MCP: sus gustos se usan en las listas. */
  userId: string;
  /** Zona horaria para el contexto automático (hora y día de la semana). */
  timeZone?: string;
  fetch?: typeof fetch;
}

export class SintoniaApi {
  private readonly baseUrl: string;
  private readonly fetch: typeof fetch;
  private readonly options: ApiOptions;

  // Sin propiedades en el constructor: Node ejecuta este TypeScript quitando los tipos.
  constructor(options: ApiOptions) {
    this.options = options;
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  domains() {
    return this.request<Domain[]>('GET', '/domains');
  }

  browse(domainId: string, query: { q?: string; tags?: string[]; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (query.tags?.length) params.set('tags', query.tags.join(','));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.offset) params.set('offset', String(query.offset));
    const qs = params.size ? `?${params}` : '';
    return this.request<{ total: number; items: Item[] }>('GET', `/domains/${enc(domainId)}/items${qs}`);
  }

  item(id: string) {
    return this.request<Item>('GET', `/items/${enc(id)}`);
  }

  similar(id: string, limit = 5) {
    return this.request<(Item & { similarity?: number })[]>('GET', `/items/${enc(id)}/similar?limit=${limit}`);
  }

  startSession(domainId: string, initialText?: string) {
    return this.request<SessionView>('POST', '/sessions', {
      domainId,
      ...(initialText ? { initialText } : {}),
      client: { timeZone: this.options.timeZone },
    });
  }

  session(id: string) {
    return this.request<SessionView>('GET', `/sessions/${enc(id)}`);
  }

  answer(id: string, answer: Answer, step: number) {
    return this.request<SessionView>('POST', `/sessions/${enc(id)}/answers`, { answer, step });
  }

  autoAnswer(id: string) {
    return this.request<AutoAnswer>('POST', `/sessions/${enc(id)}/auto-answer`);
  }

  setPreferences(id: string, preferences: Record<string, string>) {
    return this.request<unknown>('PUT', `/sessions/${enc(id)}/preferences`, { preferences });
  }

  /** Afinando por Server-Sent Events: devuelve cada paso hasta `done` o `error`. */
  async *tune(id: string, refinements: string[] = []): AsyncGenerator<TuningEvent> {
    const qs = refinements.length ? `?refine=${enc(refinements.join(','))}` : '';
    const response = await this.send('GET', `/sessions/${enc(id)}/tune${qs}`, undefined, { accept: 'text/event-stream' });
    if (!response.body) throw new ApiError(response.status, 'La API no ha devuelto el progreso de Afinando');
    for await (const data of readSse(response.body)) {
      const event = JSON.parse(data) as TuningEvent;
      yield event;
      if (event.step === 'done' || event.step === 'error') return;
    }
  }

  result(id: string) {
    return this.request<SessionResult>('GET', `/sessions/${enc(id)}/result`);
  }

  taste(domainId: string) {
    return this.request<Taste>('GET', `/taste/${enc(domainId)}`);
  }

  saveTaste(domainId: string, body: { likes: string[]; dislikes: string[]; preferences?: Record<string, string> }) {
    return this.request<Taste>('PUT', `/taste/${enc(domainId)}`, body);
  }

  interpretTaste(domainId: string, text: string) {
    return this.request<{ likes: TasteLabel[]; dislikes: TasteLabel[] }>('POST', `/taste/${enc(domainId)}/interpret`, { text });
  }

  feedback(domainId: string, itemId: string, value: 'up' | 'down' | null) {
    return this.request<unknown>('POST', `/taste/${enc(domainId)}/feedback`, { itemId, value });
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this.send(method, path, body);
    const text = await response.text();
    return (text ? JSON.parse(text) : null) as T;
  }

  private async send(method: string, path: string, body?: unknown, { accept = 'application/json' } = {}) {
    let response: Response;
    try {
      response = await this.fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          accept,
          'x-sintonia-user': this.options.userId,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new ApiError(0, `No puedo conectar con la API de Sintonía en ${this.baseUrl} (¿está arrancada?): ${(error as Error).message}`);
    }
    if (!response.ok) throw new ApiError(response.status, await errorMessage(response));
    return response;
  }
}

/** Datos (`data:`) de cada evento de un flujo Server-Sent Events. */
export async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, '\n');
    let end: number;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const data = sseData(buffer.slice(0, end));
      buffer = buffer.slice(end + 2);
      if (data !== null) yield data;
    }
  }
  const rest = sseData(buffer);
  if (rest !== null) yield rest;
}

function sseData(block: string): string | null {
  const lines = block
    .split('\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).replace(/^ /, ''));
  return lines.length ? lines.join('\n') : null;
}

async function errorMessage(response: Response) {
  const text = await response.text().catch(() => '');
  try {
    const json = JSON.parse(text) as { message?: string | string[] };
    const message = Array.isArray(json.message) ? json.message.join('; ') : json.message;
    if (message) return message;
  } catch {
    // No era JSON: se usa el texto tal cual.
  }
  return text.slice(0, 200) || `La API respondió ${response.status}`;
}

const enc = encodeURIComponent;
