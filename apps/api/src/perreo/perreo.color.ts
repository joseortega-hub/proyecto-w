// Color propio de cada artista del Modo Perreo: el más vivo de su foto o, si la foto es apagada, el de su subgénero.
import sharp from 'sharp';

/** Acentos por subgénero (de la guía de diseño de UrbanoPedia: más energía, más saturación). */
const STYLE_COLORS: [RegExp, string][] = [
  [/dembow|rkt|mambo|reparto/, '#ff4f5e'],
  [/trap|drill/, '#9357c9'],
  [/old school|perreo/, '#e8a23c'],
  [/romántico|romantico|pop/, '#8fb8d9'],
  [/dancehall|afro|moombah/, '#2fd38a'],
];
const PALETTE = ['#ff4fd0', '#ff4f5e', '#e8a23c', '#9cff4a', '#2fd3c8', '#9357c9', '#ff8a3d', '#4f8bff'];

const toHex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** RGB 0–255 → tono (0–360), saturación y luz (0–1). */
function hsl(r: number, g: number, b: number) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === R ? ((G - B) / d + 6) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return { h: h * 60, s, l };
}

/**
 * El color más vivo de una foto (píxeles RGB seguidos): agrupa por tono en 12 cubos, pesa cada píxel
 * por lo saturado que es y se queda con el cubo más fuerte. Fotos en blanco y negro o muy apagadas → null.
 */
export function vividColor(pixels: Uint8Array, channels = 3): string | null {
  const buckets = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  for (let i = 0; i + 2 < pixels.length; i += channels) {
    const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const { h, s, l } = hsl(r, g, b);
    // Ni casi negro ni casi blanco: ahí el tono no se ve.
    if (s < 0.35 || l < 0.18 || l > 0.85) continue;
    const w = s * s * (1 - Math.abs(l - 0.5));
    const k = buckets[Math.floor(h / 30) % 12];
    k.w += w;
    k.r += r * w;
    k.g += g * w;
    k.b += b * w;
  }
  const best = buckets.reduce((a, b) => (b.w > a.w ? b : a));
  // Hace falta un mínimo de color de verdad (≈ 3 % de la foto bien saturada).
  if (best.w < (pixels.length / channels) * 0.03 * 0.25) return null;
  return brighten(best.r / best.w, best.g / best.w, best.b / best.w);
}

/** Sube la luz y la saturación para que brille sobre el fondo oscuro del Modo Perreo. */
function brighten(r: number, g: number, b: number): string {
  const { h, s, l } = hsl(r, g, b);
  const S = Math.max(s, 0.75);
  const L = Math.min(Math.max(l, 0.55), 0.68);
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = L - c / 2;
  const [R, G, B] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex((R + m) * 255, (G + m) * 255, (B + m) * 255);
}

/** Sin foto con color: el de su subgénero principal o, si no, uno fijo de la paleta según su nombre. */
export function fallbackColor(slug: string, styles: string[]): string {
  for (const s of styles) for (const [re, color] of STYLE_COLORS) if (re.test(s.toLowerCase())) return color;
  let hash = 0;
  for (const ch of slug) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

/** Color de un artista a partir de su foto en base64 (WebP), con respaldo. */
export async function artistColor(slug: string, styles: string[], photoBase64: string | null): Promise<string> {
  if (photoBase64) {
    try {
      const { data, info } = await sharp(Buffer.from(photoBase64, 'base64')).resize(32, 32, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const vivid = vividColor(data, info.channels);
      if (vivid) return vivid;
    } catch {
      /* foto ilegible: respaldo */
    }
  }
  return fallbackColor(slug, styles);
}
