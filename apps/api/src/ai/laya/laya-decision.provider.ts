import { Logger } from '@nestjs/common';
import type { DecisionProvider, DecisionQuestion } from '../decision-provider.js';
import { isTransient } from '../model-fallback.js';
import { JevDecisionProvider } from '../jev/jev-decision.provider.js';

/** La primera carga del modelo en CPU tarda ~30 s; después responde en ~0,3-1 s. */
const WARMUP_TIMEOUT_MS = 120_000;

/**
 * Laya en local a través de Ollaya, que habla el mismo protocolo que Jev
 * (`POST /v1/systemone`), así que se reutiliza `JevDecisionProvider` con otra base URL.
 *
 * Mientras el modelo no está cargado, `decide` falla al instante para que la cadena
 * pase al siguiente proveedor en vez de esperar. Al arrancar se precalienta con
 * `POST /api/decide` y `keep_alive: -1`, que deja el modelo cargado sin caducidad.
 * Si Ollaya no está (p. ej. en producción), el precalentamiento falla en silencio y
 * Laya se salta; se reintenta cada pocos minutos por si aparece.
 */
export class LayaDecisionProvider implements DecisionProvider {
  readonly name: string;
  private readonly jev: JevDecisionProvider;
  private readonly logger = new Logger('Laya');
  private ready = false;
  private warming: Promise<boolean> | null = null;
  private lastWarmup = 0;

  constructor(
    private readonly baseURL: string,
    private readonly model: string,
    timeoutMs: number,
    private readonly retryWarmupMs = 3 * 60_000,
  ) {
    // Ollaya acepta cualquier Bearer no vacío, pero no cuerpos comprimidos (400 "invalid JSON").
    this.jev = new JevDecisionProvider({
      apiKey: 'local',
      model,
      baseURL,
      timeoutMs,
      maxRetries: 0,
      label: 'ollaya',
      compression: false,
    });
    this.name = this.jev.name;
  }

  async decide<Q extends Record<string, DecisionQuestion>>(state: string | Record<string, unknown>, questions: Q) {
    if (!this.ready) {
      if (!this.warming && Date.now() - this.lastWarmup > this.retryWarmupMs) void this.warmUp();
      throw new Error('Laya aún no está cargado');
    }
    try {
      return await this.jev.decide(state, questions);
    } catch (error) {
      // Si se cayó o descargó el modelo, se vuelve a calentar en segundo plano.
      if (isTransient(error)) this.ready = false;
      throw error;
    }
  }

  /** Carga el modelo y lo deja residente. Devuelve si quedó listo. */
  warmUp(): Promise<boolean> {
    this.warming ??= (async () => {
      this.lastWarmup = Date.now();
      const started = Date.now();
      try {
        const res = await fetch(`${this.baseURL}/api/decide`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            keep_alive: -1,
            state: 'calentando',
            questions: { ok: { type: 'choice', instructions: 'Elige una', criteria: { a: 'A', b: 'B' } } },
          }),
          signal: AbortSignal.timeout(WARMUP_TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        this.ready = true;
        this.logger.log(`${this.model} cargado en ${Date.now() - started} ms (residente)`);
      } catch (error) {
        this.logger.warn(`${this.model} no disponible en ${this.baseURL} (${(error as Error).message}); se salta`);
      } finally {
        this.warming = null;
      }
      return this.ready;
    })();
    return this.warming;
  }
}
