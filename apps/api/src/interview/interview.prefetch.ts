import type { Answer, InterviewTurn } from './interview.types.js';

const TTL_MS = 5 * 60_000;

/**
 * Precarga de la siguiente pregunta. Mientras la persona lee la pregunta actual, el
 * servidor ya calcula la siguiente para "sí" y para "no". Al llegar la respuesta,
 * si la precarga está lista (o en marcha), se usa en vez de empezar de cero.
 *
 * La clave incluye cuántas respuestas había: si la sesión cambia (deshacer, otra
 * respuesta), la precarga antigua deja de coincidir y se ignora.
 */
export class NextQuestionPrefetch {
  private readonly entries = new Map<string, { promise: Promise<InterviewTurn[]>; at: number }>();

  /** Desactivable con INTERVIEW_PREFETCH=false si el plan gratuito se queda corto de cuota. */
  readonly enabled = process.env.INTERVIEW_PREFETCH !== 'false';

  private key(sessionId: string, answeredCount: number, answer: Answer) {
    return `${sessionId}:${answeredCount}:${answer}`;
  }

  start(sessionId: string, answeredCount: number, answer: Answer, compute: () => Promise<InterviewTurn[]>) {
    if (!this.enabled) return;
    this.sweep();
    const promise = compute();
    // Un fallo de la precarga no debe tumbar nada: al responder se recalcula.
    promise.catch(() => this.entries.delete(this.key(sessionId, answeredCount, answer)));
    this.entries.set(this.key(sessionId, answeredCount, answer), { promise, at: Date.now() });
  }

  /** Devuelve (y retira) la precarga que coincide, o null si no hay. */
  take(sessionId: string, answeredCount: number, answer: Answer): Promise<InterviewTurn[]> | null {
    const k = this.key(sessionId, answeredCount, answer);
    const entry = this.entries.get(k);
    this.forget(sessionId);
    if (!entry || Date.now() - entry.at > TTL_MS) return null;
    return entry.promise;
  }

  /** Olvida todas las precargas de una sesión (tras responder o deshacer). */
  forget(sessionId: string) {
    for (const k of this.entries.keys()) if (k.startsWith(`${sessionId}:`)) this.entries.delete(k);
  }

  private sweep() {
    const now = Date.now();
    for (const [k, e] of this.entries) if (now - e.at > TTL_MS) this.entries.delete(k);
  }
}
