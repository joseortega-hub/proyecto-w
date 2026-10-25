import { Logger } from '@nestjs/common';

/**
 * Los planes gratuitos a veces se saturan (503 "high demand"), se quedan sin cupo o
 * se cuelgan. En vez de reintentar el mismo modelo, se falla rápido y se pasa al
 * siguiente de la cadena. El modelo (o proveedor) que falla queda apartado unos
 * minutos ("cortacircuitos"): así las llamadas siguientes no vuelven a esperar a que
 * se agote su timeout.
 */
export const COOLDOWN_MS = 3 * 60_000;
/** Un modelo retirado (404) no vuelve en horas: se aparta más tiempo. */
export const GONE_COOLDOWN_MS = 30 * 60_000;
const cooldownUntil = new Map<string, number>();

export const isTransient = (error: unknown) =>
  ['TimeoutError', 'AbortError'].includes((error as Error)?.name) ||
  /high demand|overloaded|unavailable|resource.?exhausted|quota|rate.?limit|timeout|timed out|aborted|fetch failed|econnrefused|econnreset|connection|\b(429|500|502|503)\b/i.test(
    String((error as Error)?.message ?? error),
  );

/**
 * El modelo ya no existe o su proveedor no lo sirve (404/410, "no endpoints", retirado). Es lo que
 * pasó con OpenRouter: un `:free` retirado devolvía 404 y bloqueaba también a los demás modelos.
 */
export const isModelGone = (error: unknown) => {
  const status = (error as { statusCode?: number })?.statusCode;
  return (
    status === 404 ||
    status === 410 ||
    /not found|no endpoints|model_not_found|decommission|deprecated|does not exist|no longer available/i.test(String((error as Error)?.message ?? error))
  );
};

/**
 * Fallos de la respuesta, no del servicio (p. ej. Groq: "Failed to generate JSON"): se
 * prueba el siguiente modelo, pero sin apartar este, porque el siguiente intento suele ir bien.
 */
export const isBadOutput = (error: unknown) =>
  /failed to generate|no object generated|(does|did) not match|could not parse|invalid json/i.test(String((error as Error)?.message ?? error));

/** Disponibles primero (en su orden); los apartados, al final, por si fallan todos. */
export function modelOrder(models: string[], now = Date.now()): string[] {
  const ready = models.filter((m) => (cooldownUntil.get(m) ?? 0) <= now);
  const cooling = models
    .filter((m) => (cooldownUntil.get(m) ?? 0) > now)
    .sort((a, b) => cooldownUntil.get(a)! - cooldownUntil.get(b)!);
  return [...ready, ...cooling];
}

/** Aparta un modelo o proveedor hasta `until` (lo usan las cadenas de respaldo y los tests). */
export function coolDown(key: string, until = Date.now() + COOLDOWN_MS) {
  cooldownUntil.set(key, until);
}

export function recover(key: string) {
  cooldownUntil.delete(key);
}

/** Prueba los modelos en orden; salta al siguiente ante errores pasajeros o respuestas mal formadas. */
export async function withModelFallback<T>(
  models: string[],
  call: (model: string) => Promise<T>,
  logger = new Logger('Modelos'),
): Promise<T> {
  let lastError: unknown;
  for (const model of modelOrder(models)) {
    try {
      const result = await call(model);
      recover(model);
      return result;
    } catch (error) {
      lastError = error;
      if (isTransient(error)) {
        coolDown(model);
        logger.warn(`${model} no disponible (${(error as Error).message?.slice(0, 80)}); lo aparto unos minutos`);
      } else if (isModelGone(error)) {
        coolDown(model, Date.now() + GONE_COOLDOWN_MS);
        logger.warn(`${model} ya no está disponible (${(error as Error).message?.slice(0, 80)}); lo aparto y pruebo el siguiente`);
      } else if (isBadOutput(error)) {
        logger.warn(`${model} respondió mal (${(error as Error).message?.slice(0, 80)}); pruebo el siguiente`);
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}
