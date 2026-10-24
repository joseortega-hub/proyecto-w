/**
 * Precios de lista (USD por millón de tokens, entrada/salida), aproximados: sirven para
 * decir "en el plan gratuito cuesta 0 €, pero equivaldría a X". No son facturación.
 * Se busca por trozo del nombre del modelo; si no hay, por proveedor.
 */
export const USD_TO_EUR = 0.92;

const BY_MODEL: [match: string, input: number, output: number][] = [
  ['gpt-oss-120b', 0.15, 0.75],
  ['qwen', 0.29, 0.59],
  ['nemotron', 0.1, 0.5],
  ['flash-lite', 0.1, 0.4],
  ['flash', 0.3, 2.5],
  ['embedding', 0.15, 0],
];
const BY_PROVIDER: Record<string, [number, number]> = {
  groq: [0.15, 0.75],
  cerebras: [0.35, 0.75],
  openrouter: [0.1, 0.5],
  gemini: [0.1, 0.4],
  jev: [0.3, 1.2],
};

/** Planes sin coste para esta app. Jev es de pago; Laya corre en local. */
export const FREE_PROVIDERS = new Set(['groq', 'laya', 'gemini', 'cerebras', 'openrouter']);

export function estimateCost(provider: string | null, model: string | null, inputTokens: number | null, outputTokens: number | null) {
  const label = provider ?? '';
  const byModel = BY_MODEL.find(([m]) => model?.includes(m));
  const [input, output] = label === 'laya' ? [0, 0] : byModel ? [byModel[1], byModel[2]] : (BY_PROVIDER[label] ?? [0, 0]);
  const usd = ((inputTokens ?? 0) * input + (outputTokens ?? 0) * output) / 1_000_000;
  return { listEur: usd * USD_TO_EUR, free: FREE_PROVIDERS.has(label) };
}
