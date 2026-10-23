// Utilidades comunes de los adaptadores: atributos a partir de etiquetas y peticiones HTTP con calma.

export const clamp = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 100) / 100;

/**
 * Media de los valores de partida de las etiquetas que tiene el elemento. Cada clave sin
 * ninguna etiqueta conocida se queda con su valor base.
 */
export function priorAverage<K extends string>(
  tags: string[],
  priors: Record<string, Partial<Record<K, number>>>,
  base: Record<K, number>,
): Record<K, number> {
  const known = tags.map((t) => priors[t]).filter(Boolean);
  const out = { ...base };
  for (const key of Object.keys(base) as K[]) {
    const values = known.map((p) => p[key]).filter((v): v is number => v !== undefined);
    if (values.length) out[key] = values.reduce((a, b) => a + b, 0) / values.length;
  }
  return out;
}

/** Suma `delta` por cada etiqueta presente de la lista. */
export const nudge = (tags: string[], words: Record<string, number>) =>
  tags.reduce((sum, t) => sum + (words[t] ?? 0), 0);

/** Escala logarítmica 0–1 (para popularidades que van de 10 a 1 000 000). */
export const logScale = (value: number, max: number) => (max > 0 ? clamp(Math.log1p(value) / Math.log1p(max)) : 0);

/** Posición de un año entre `from` y `to`, 0–1. */
export const yearScale = (year: number | null | undefined, from: number, to: number) =>
  year ? clamp((year - from) / (to - from)) : 0.5;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET JSON con reintentos ante 429 y 5xx. `minIntervalMs` espacia las peticiones para
 * respetar los límites de cada API (Open Library pide como mucho 1-3 por segundo).
 */
export function politeFetcher(options: { minIntervalMs: number; headers?: Record<string, string>; name: string }) {
  let last = 0;
  let queue = Promise.resolve();
  const wait = () => {
    const turn = queue.then(async () => {
      const delay = last + options.minIntervalMs - Date.now();
      if (delay > 0) await sleep(delay);
      last = Date.now();
    });
    queue = turn.catch(() => undefined);
    return turn;
  };

  return async function getJson<T>(url: string | URL): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      await wait();
      const res = await fetch(url, { headers: options.headers });
      if (res.ok) return (await res.json()) as T;
      if ((res.status === 429 || res.status >= 500) && attempt < 4) {
        const retryAfter = Number(res.headers.get('retry-after')) || 0;
        await sleep(Math.max(retryAfter * 1000, 2000 * attempt));
        continue;
      }
      throw new Error(`${options.name} respondió ${res.status} en ${String(url).replace(/(key|api_key)=[^&]+/g, '$1=…')}`);
    }
  };
}

/** Aplica `fn` a cada elemento con como mucho `concurrency` a la vez. Los fallos devuelven null. */
export async function mapLimit<T, R>(list: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>) {
  const out: (R | null)[] = Array.from({ length: list.length }, () => null);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, list.length) }, async () => {
    while (next < list.length) {
      const i = next++;
      out[i] = await fn(list[i], i).catch(() => null);
    }
  });
  await Promise.all(workers);
  return out;
}
