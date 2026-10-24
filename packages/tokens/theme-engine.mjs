// Motor de temas compartido: color (OKLCH), contraste WCAG, derivación de colores semánticos, sombras y CSS.
// Lo usan gen-tokens.mjs (temas fijos), la API (valida y corrige los temas generados con IA) y la web (inyecta su CSS).
// Sin dependencias: JavaScript puro, con tipos en theme-engine.d.ts.

// ---------- Color: sRGB ↔ OKLCH y contraste WCAG 2.x ----------
const hexToRgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.replace('#', '').slice(i, i + 2), 16) / 255);
const rgbToHex = (rgb) => '#' + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('');
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.cbrt(c) ** (3 / 2.4) - 0.055);
export function hexToOklch(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}
function oklchToRgb([L, C, h]) {
  const A = C * Math.cos((h * Math.PI) / 180), B = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ].map(fromLin);
}
/** OKLCH → hex, bajando el croma hasta que cabe en sRGB (conserva tono y luminosidad). */
export function oklch(L, C, h) {
  let c = C;
  for (; c > 0; c -= 0.002) {
    const rgb = oklchToRgb([L, c, h]);
    if (rgb.every((v) => v >= -0.001 && v <= 1.001)) return rgbToHex(rgb);
  }
  return rgbToHex(oklchToRgb([L, 0, h]));
}
export const luminance = (hex) => { const [r, g, b] = hexToRgb(hex).map(toLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** Ajusta la luminosidad (oscurece en claro, aclara en oscuro) hasta llegar al contraste pedido frente a todos los fondos. */
export function ensureContrast(hex, against, mode, min = 4.5, chroma = 1) {
  let [L, C, h] = hexToOklch(hex);
  C *= chroma;
  let v = oklch(L, C, h);
  for (let i = 0; i < 100 && against.some((bg) => contrast(v, bg) < min); i++) {
    L = Math.min(1, Math.max(0, L + (mode === 'dark' ? 0.01 : -0.01)));
    v = oklch(L, C, h);
  }
  return v;
}

// Color de cada temática (el de Sintonía); en cada tema se ajusta su luminosidad hasta pasar AA sobre fondo y tarjeta.
export const domainBase = {
  music: ['#3d4bf0', '#8290ff'],
  youtube: ['#d92d20', '#ff7a6e'],
  folder: ['#b45309', '#ffb454'],
  games: ['#8a3fd1', '#c59bff'],
  movies: ['#c22e6e', '#ff80b5'],
  books: ['#0b7f7a', '#4fd1c5'],
  perreo: ['#c4137f', '#ff5cc8']
};

// ---------- Sombras: capas [x, y, blur, spread, color, alfa] ----------
export const softShadow = (tint, k = 1) => (mode) => {
  const color = mode === 'dark' ? '#000000' : tint;
  const f = mode === 'dark' ? 2.2 * k : k;
  return {
    xs: [[0, 1, 1, 0, color, 0.05 * f]],
    sm: [[0, 1, 2, 0, color, 0.08 * f]],
    md: [[0, 4, 12, -2, color, 0.12 * f]],
    lg: [[0, 12, 32, -8, color, 0.18 * f]],
    xl: [[0, 20, 44, -12, color, 0.24 * f]]
  };
};
export const glowShadow = (mode, c) => {
  const a = mode === 'dark' ? 1.4 : 1;
  const ring = [0, 0, 0, 1, c.primary, 0.18 * a];
  return {
    xs: [[0, 1, 2, 0, c.primary, 0.12 * a]],
    sm: [ring, [0, 2, 8, -2, c.primary, 0.22 * a]],
    md: [ring, [0, 6, 20, -6, c.primary, 0.32 * a]],
    lg: [ring, [0, 14, 36, -10, c.primary, 0.4 * a]],
    xl: [ring, [0, 22, 56, -14, c.primary, 0.46 * a]]
  };
};
export const hardShadow = (mode, c) => {
  const col = mode === 'dark' ? c.border : c.foreground;
  return { xs: [[1, 1, 0, 0, col, 1]], sm: [[2, 2, 0, 0, col, 1]], md: [[4, 4, 0, 0, col, 1]], lg: [[6, 6, 0, 0, col, 1]], xl: [[8, 8, 0, 0, col, 1]] };
};


/** Señal derivada del primario: tono complementario desplazado (o el fijado por el tema), con contraste comprobado. */
export function deriveSignal(c, mode, hue) {
  const [, , ph] = hexToOklch(c.primary);
  const h = hue ?? (ph + 150) % 360;
  const signal = mode === 'dark' ? oklch(0.8, 0.15, h) : oklch(0.68, 0.18, h);
  return {
    signal,
    'signal-foreground': ensureContrast(mode === 'dark' ? oklch(0.82, 0.14, h) : oklch(0.52, 0.15, h), [c.background, c.card], mode),
    'signal-muted': mode === 'dark' ? oklch(0.27, 0.05, h) : oklch(0.95, 0.04, h)
  };
}

export const MODES = ['light', 'dark'];
export const r3 = (n) => Math.round(n * 1000) / 1000;
export const rgbCss = (hex, a) => `rgb(${hexToRgb(hex).map((v) => Math.round(v * 255)).join(' ')} / ${r3(a)})`;
export const shadowCss = (layers) => layers.map(([x, y, b, s, col, a]) => `${x}px ${y}px ${b}px ${s}px ${a === 1 ? col : rgbCss(col, a)}`).join(', ');
export const fam = (a) => a.map((f) => (f.includes(' ') ? `"${f}"` : f)).join(', ');

// Sí y No tienen significado: son iguales en todos los temas (igual que destructive). [claro, oscuro]
export const FIXED = { yes: ['#17855a', '#3ccb92'], no: ['#c93a55', '#ff6e86'], destructive: ['#c93a55', '#ff6e86'] };

export const BASE_FONTS = {
  display: ['Bricolage Grotesque Variable', 'Bricolage Grotesque', 'Segoe UI', 'system-ui', 'sans-serif'],
  body: ['Atkinson Hyperlegible', 'Segoe UI', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono Variable', 'JetBrains Mono', 'Cascadia Mono', 'ui-monospace', 'monospace']
};
/** Lista cerrada de fuentes disponibles en la web (`load` = paquete @fontsource-variable que la web descarga). */
export const FONT_CHOICES = {
  sintonia: { label: 'Bricolage (la de Sintonía)', fonts: {}, load: [] },
  inter: { label: 'Inter (limpia)', fonts: { display: ['Inter Variable', 'Segoe UI', 'system-ui', 'sans-serif'], body: ['Inter Variable', 'Segoe UI', 'system-ui', 'sans-serif'] }, load: ['inter'] },
  unbounded: { label: 'Unbounded (urbana, ancha)', fonts: { display: ['Unbounded Variable', 'Segoe UI', 'system-ui', 'sans-serif'] }, load: ['unbounded'] },
  fraunces: { label: 'Fraunces (serifa cálida)', fonts: { display: ['Fraunces Variable', 'Georgia', 'serif'] }, load: ['fraunces'] },
  'space-grotesk': { label: 'Space Grotesk (geométrica)', fonts: { display: ['Space Grotesk Variable', 'Segoe UI', 'system-ui', 'sans-serif'], body: ['Space Grotesk Variable', 'Segoe UI', 'system-ui', 'sans-serif'] }, load: ['space-grotesk'] }
};
export const SHADOW_STYLES = ['suave', 'brillo', 'duras'];
const shadowFor = (style, foreground) => (style === 'brillo' ? glowShadow : style === 'duras' ? hardShadow : softShadow(foreground));

// ---------- Contraste ----------
export const TEXT_PAIRS = [
  ['foreground', 'background'], ['foreground', 'card'], ['muted-foreground', 'background'], ['muted-foreground', 'card'],
  ['primary-foreground', 'primary'], ['secondary-foreground', 'secondary'], ['accent-foreground', 'accent'],
  ['signal-foreground', 'background'], ['signal-foreground', 'card']
];
// Sí/No son fijos: se avisa si en algún tema quedan justos, sin fallar.
export const SOFT_PAIRS = [['muted-foreground', 'secondary'], ['yes', 'card'], ['no', 'card'], ['primary', 'background']];

/** Parejas de texto (y colores de temática) por debajo de AA, para un modo ya resuelto. */
export function failingPairs(colors, domains) {
  const out = [];
  for (const [fg, bg] of TEXT_PAIRS) {
    const r = contrast(colors[fg], colors[bg]);
    if (r < 4.5) out.push(`${fg} sobre ${bg} = ${r.toFixed(2)}`);
  }
  for (const [d, v] of Object.entries(domains)) {
    const r = Math.min(contrast(v, colors.background), contrast(v, colors.card));
    if (r < 4.5) out.push(`dominio ${d} = ${r.toFixed(2)}`);
  }
  return out;
}

// ---------- Derivación del tema completo ----------
/** Los 23 colores semánticos de un modo a partir de los 10 base (más el tono de señal opcional). */
export function deriveColors(m, mode, signalHue) {
  const i = MODES.indexOf(mode);
  const c = {
    background: m.background, foreground: m.foreground, card: m.card, 'card-foreground': m.foreground,
    popover: m.card, 'popover-foreground': m.foreground, primary: m.primary, 'primary-foreground': m['primary-foreground'],
    secondary: m.secondary, 'secondary-foreground': m.foreground, muted: m.secondary, 'muted-foreground': m['muted-foreground'],
    accent: m.accent, 'accent-foreground': m['accent-foreground'], destructive: FIXED.destructive[i], border: m.border,
    input: m.border, ring: m.primary
  };
  Object.assign(c, deriveSignal(c, mode, signalHue));
  c.yes = FIXED.yes[i];
  c.no = FIXED.no[i];
  return Object.fromEntries(Object.entries(c).map(([n, v]) => [n, v.toLowerCase()]));
}

/** Color de cada temática ajustado a AA sobre fondo y tarjeta. */
export function resolveDomains(colors, mode, chroma = 1) {
  const i = MODES.indexOf(mode);
  return Object.fromEntries(Object.entries(domainBase).map(([d, base]) => [d, ensureContrast(base[i], [colors.background, colors.card], mode, 4.5, chroma)]));
}

const HEX = /^#[0-9a-f]{6}$/i;
/** [campo a corregir, fondos contra los que se mide, mínimo, cómo se nombra en el aviso] */
const BASE_PAIRS = [
  ['primary', ['background'], 3, 'el color principal'],
  ['foreground', ['background', 'card', 'secondary'], 4.5, 'el texto'],
  ['muted-foreground', ['background', 'card', 'secondary'], 4.5, 'el texto secundario'],
  ['primary-foreground', ['primary'], 4.5, 'el texto de los botones'],
  ['accent-foreground', ['accent'], 4.5, 'el texto de acento']
];

/**
 * Mueve la luminosidad (OKLCH) del color hasta llegar al contraste mínimo frente a todos los fondos:
 * oscurece sobre fondos claros y aclara sobre oscuros. Si no llega, usa negro o blanco.
 */
export function fixContrast(hex, backgrounds, min = 4.5) {
  if (backgrounds.every((bg) => contrast(hex, bg) >= min)) return { hex, direction: null };
  const bgLum = backgrounds.reduce((s, bg) => s + luminance(bg), 0) / backgrounds.length;
  const step = bgLum > 0.18 ? -0.01 : 0.01;
  let [L, C, h] = hexToOklch(hex);
  let v = hex;
  for (let i = 0; i < 100 && backgrounds.some((bg) => contrast(v, bg) < min); i++) {
    L = Math.min(1, Math.max(0, L + step));
    v = oklch(L, C, h);
  }
  if (backgrounds.some((bg) => contrast(v, bg) < min)) v = step < 0 ? '#000000' : '#ffffff';
  return { hex: v, direction: step < 0 ? 'darker' : 'lighter' };
}

/** Corrige los 10 colores base de un modo para que cumplan AA. Devuelve los corregidos y qué se tocó. */
export function fixBase(base, mode) {
  const fixed = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v.toLowerCase()]));
  const fixes = [];
  for (const [field, against, min, label] of BASE_PAIRS) {
    const r = fixContrast(fixed[field], against.map((n) => fixed[n]), min);
    if (r.direction) {
      fixed[field] = r.hex;
      fixes.push({ mode, field, label, direction: r.direction });
    }
  }
  return { base: fixed, fixes };
}

const fixNotice = (f) => `He ${f.direction === 'darker' ? 'oscurecido' : 'aclarado'} ${f.label} (modo ${f.mode === 'dark' ? 'oscuro' : 'claro'}) para que se lea bien.`;

/**
 * Convierte una propuesta (colores base claro/oscuro, radio, sombras, fuente) en un tema completo con el
 * contraste garantizado. Los colores deben ser #rrggbb: lo valida quien llama (la API con Zod).
 */
export function buildTheme(raw) {
  const font = FONT_CHOICES[raw.font] ?? FONT_CHOICES.sintonia;
  const fixes = [];
  const modes = Object.fromEntries(
    MODES.map((mode) => {
      for (const v of Object.values(raw[mode])) if (!HEX.test(v)) throw new Error('Color no válido');
      const { base, fixes: f } = fixBase(raw[mode], mode);
      fixes.push(...f);
      const colors = deriveColors(base, mode);
      const domains = resolveDomains(colors, mode);
      return [mode, { colors, domains, shadow: shadowFor(raw.shadow, raw.light.foreground)(mode, colors) }];
    })
  );
  const theme = {
    label: raw.name,
    fonts: { ...BASE_FONTS, ...font.fonts },
    load: font.load,
    radius: Math.min(24, Math.max(0, Math.round(raw.radius))),
    modes
  };
  for (const mode of MODES) {
    const bad = failingPairs(modes[mode].colors, modes[mode].domains);
    if (bad.length) throw new Error(`Contraste insuficiente tras corregir: ${bad.join('; ')}`);
  }
  return { theme, notices: fixes.map(fixNotice) };
}

// ---------- CSS ----------
export function modeDecls(t, mode, withShape) {
  const m = t.modes[mode];
  const d = Object.entries(m.colors).map(([n, v]) => `--${n}: ${v};`);
  if (withShape) d.push(`--radius: ${t.radius}px;`, `--display-font: ${fam(t.fonts.display)};`, `--body-font: ${fam(t.fonts.body)};`, `--mono-font: ${fam(t.fonts.mono)};`);
  for (const [k, layers] of Object.entries(m.shadow)) d.push(`--elevation-${k}: ${shadowCss(layers)};`);
  return d;
}

/**
 * Líneas de CSS de un tema: variables en claro (`:root[data-theme]`) y oscuro (`:root.dark[data-theme]`) más el
 * color de cada temática. El tema por defecto va en `:root` y `.dark`.
 */
export function themeCssLines(id, t, isDefault = false) {
  const light = isDefault ? ':root' : `:root[data-theme='${id}']`;
  const dark = isDefault ? '.dark' : `:root.dark[data-theme='${id}']`;
  const lines = [];
  const block = (selector, decls) => lines.push(`${selector} {`, ...decls.map((d) => `  ${d}`), '}', '');
  block(light, modeDecls(t, 'light', true));
  block(dark, modeDecls(t, 'dark', false));
  for (const d of Object.keys(domainBase)) {
    lines.push(`${isDefault ? '' : light + ' '}[data-domain='${d}'] { --domain: ${t.modes.light.domains[d]}; }`);
    lines.push(`${dark} [data-domain='${d}'] { --domain: ${t.modes.dark.domains[d]}; }`);
  }
  return lines;
}
export const themeCss = (id, t) => themeCssLines(id, t).join('\n');

/** Lo que el menú necesita de un tema: muestras y color de la barra del navegador por modo. */
export function menuModes(t) {
  return Object.fromEntries(
    MODES.map((mode) => {
      const c = t.modes[mode].colors;
      return [mode, { swatches: [c.background, c.primary, c.signal, c.accent], themeColor: mode === 'dark' ? c.background : c.primary }];
    })
  );
}
