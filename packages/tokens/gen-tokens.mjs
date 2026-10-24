// Genera tokens.json (W3C DTCG 2025.10), theme.css (Tailwind v4 + shadcn/ui) y themes.json (menú de temas).
// Uso: node gen-tokens.mjs [carpeta]  (por defecto, la carpeta de este paquete)
// Comprueba el contraste WCAG de cada tema en claro y oscuro: si una pareja de texto no llega a AA, falla.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = process.argv[2] ?? dirname(fileURLToPath(import.meta.url));
mkdirSync(out, { recursive: true });

// ---------- Color: sRGB ↔ OKLCH y contraste WCAG 2.x ----------
const hexToRgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.replace('#', '').slice(i, i + 2), 16) / 255);
const rgbToHex = (rgb) => '#' + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('');
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.cbrt(c) ** (3 / 2.4) - 0.055);
function hexToOklch(hex) {
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
function oklch(L, C, h) {
  let c = C;
  for (; c > 0; c -= 0.002) {
    const rgb = oklchToRgb([L, c, h]);
    if (rgb.every((v) => v >= -0.001 && v <= 1.001)) return rgbToHex(rgb);
  }
  return rgbToHex(oklchToRgb([L, 0, h]));
}
const luminance = (hex) => { const [r, g, b] = hexToRgb(hex).map(toLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** Ajusta la luminosidad (oscurece en claro, aclara en oscuro) hasta llegar al contraste pedido frente a todos los fondos. */
function ensureContrast(hex, against, mode, min = 4.5, chroma = 1) {
  let [L, C, h] = hexToOklch(hex);
  C *= chroma;
  let v = oklch(L, C, h);
  for (let i = 0; i < 100 && against.some((bg) => contrast(v, bg) < min); i++) {
    L = Math.min(1, Math.max(0, L + (mode === 'dark' ? 0.01 : -0.01)));
    v = oklch(L, C, h);
  }
  return v;
}

// ---------- Paleta y semánticos del tema por defecto (Sintonía) ----------
const palette = {
  neutral: { 0: '#FFFFFF', 25: '#ECEEF8', 50: '#F3F4F8', 100: '#E8EAF2', 200: '#D3D7E4', 400: '#9AA0BD', 600: '#5A607A', 700: '#2E3350', 800: '#20243C', 850: '#171A2E', 900: '#131628', 950: '#0E1020' },
  cobalt: { 100: '#E3E6FF', 200: '#C3C9FF', 300: '#8290FF', 600: '#3D4BF0', 700: '#2F3BC4', 900: '#252A57' },
  signal: { 100: '#FFE9DA', 300: '#FFA060', 500: '#E86A1C', 700: '#A5480C', 900: '#3A2A22' },
  green: { 400: '#3CCB92', 700: '#17855A' },
  rose: { 400: '#FF6E86', 600: '#C93A55' }
};
const hexOf = (ref) => { const [g, k] = ref.split('.'); return palette[g][k].toLowerCase(); };

// nombre semántico (convención shadcn/ui) → [claro, oscuro]
const semantic = {
  background: ['neutral.50', 'neutral.950'],
  foreground: ['neutral.900', 'neutral.25'],
  card: ['neutral.0', 'neutral.850'],
  'card-foreground': ['neutral.900', 'neutral.25'],
  popover: ['neutral.0', 'neutral.850'],
  'popover-foreground': ['neutral.900', 'neutral.25'],
  primary: ['cobalt.600', 'cobalt.300'],
  'primary-foreground': ['neutral.0', 'neutral.950'],
  secondary: ['neutral.100', 'neutral.800'],
  'secondary-foreground': ['neutral.900', 'neutral.25'],
  muted: ['neutral.100', 'neutral.800'],
  'muted-foreground': ['neutral.600', 'neutral.400'],
  accent: ['cobalt.100', 'cobalt.900'],
  'accent-foreground': ['cobalt.700', 'cobalt.200'],
  destructive: ['rose.600', 'rose.400'],
  border: ['neutral.200', 'neutral.700'],
  input: ['neutral.200', 'neutral.700'],
  ring: ['cobalt.600', 'cobalt.300'],
  signal: ['signal.500', 'signal.300'],
  'signal-foreground': ['signal.700', 'signal.300'],
  'signal-muted': ['signal.100', 'signal.900'],
  yes: ['green.700', 'green.400'],
  no: ['rose.600', 'rose.400']
};
const MODES = ['light', 'dark'];
// Sí y No tienen significado: son iguales en todos los temas (igual que destructive).
const FIXED = Object.fromEntries(['yes', 'no', 'destructive'].map((n) => [n, semantic[n].map(hexOf)]));

const fonts = {
  display: ['Bricolage Grotesque Variable', 'Bricolage Grotesque', 'Segoe UI', 'system-ui', 'sans-serif'],
  body: ['Atkinson Hyperlegible', 'Segoe UI', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono Variable', 'JetBrains Mono', 'Cascadia Mono', 'ui-monospace', 'monospace']
};
const sizes = { xs: 12, sm: 14, base: 16, lg: 20, xl: 25, '2xl': 31, '3xl': 39, '4xl': 49 };
const space = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48, 16: 64 };
const radius = { sm: 6, md: 12, lg: 20, full: 999 };
const shadows = {
  sm: [0, 1, 2, 0, 0.08],
  md: [0, 4, 12, -2, 0.12],
  lg: [0, 12, 32, -8, 0.18]
};

// Color de cada temática (el de Sintonía); en cada tema se ajusta su luminosidad hasta pasar AA sobre fondo y tarjeta.
const domainBase = {
  music: ['#3d4bf0', '#8290ff'],
  youtube: ['#d92d20', '#ff7a6e'],
  games: ['#8a3fd1', '#c59bff'],
  movies: ['#c22e6e', '#ff80b5'],
  books: ['#0b7f7a', '#4fd1c5']
};

// ---------- Sombras: capas [x, y, blur, spread, color, alfa] ----------
const softShadow = (tint, k = 1) => (mode) => {
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
const glowShadow = (mode, c) => {
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
const hardShadow = (mode, c) => {
  const col = mode === 'dark' ? c.border : c.foreground;
  return { xs: [[1, 1, 0, 0, col, 1]], sm: [[2, 2, 0, 0, col, 1]], md: [[4, 4, 0, 0, col, 1]], lg: [[6, 6, 0, 0, col, 1]], xl: [[8, 8, 0, 0, col, 1]] };
};

// ---------- Temas ----------
// Valores propios, inspirados en el estilo de algunos temas de tweakcn (https://tweakcn.com, Apache-2.0),
// adaptados a los tokens de Sintonía. Cada modo da 10 colores; el resto se deriva.
const themes = {
  sintonia: {
    label: 'Sintonía',
    description: 'Cobalto y naranja señal: el diseño original.',
    shadow: softShadow('#131628')
  },
  grafito: {
    label: 'Grafito',
    description: 'Sobrio y monocromo, para concentrarse.',
    inspiredBy: 'Modern Minimal / Mono',
    fonts: { display: ['Inter Variable', 'Segoe UI', 'system-ui', 'sans-serif'], body: ['Inter Variable', 'Segoe UI', 'system-ui', 'sans-serif'] },
    load: ['inter'],
    radius: 6,
    signalHue: 55,
    domainChroma: 0.8,
    shadow: softShadow('#0a0a0a', 0.8),
    light: { background: '#fafafa', foreground: '#0a0a0a', card: '#ffffff', primary: '#171717', 'primary-foreground': '#fafafa', secondary: '#efefef', 'muted-foreground': '#5c5c5c', accent: '#ebebeb', 'accent-foreground': '#171717', border: '#e0e0e0' },
    dark: { background: '#0a0a0a', foreground: '#f2f2f2', card: '#161616', primary: '#f2f2f2', 'primary-foreground': '#111111', secondary: '#232323', 'muted-foreground': '#a3a3a3', accent: '#2a2a2a', 'accent-foreground': '#f2f2f2', border: '#2e2e2e' }
  },
  neon: {
    label: 'Neón',
    description: 'Noche urbana: magenta y cian con brillo.',
    inspiredBy: 'Cyberpunk / Synthwave',
    fonts: { display: ['Unbounded Variable', 'Segoe UI', 'system-ui', 'sans-serif'] },
    load: ['unbounded'],
    radius: 8,
    signalHue: 200,
    domainChroma: 1.2,
    shadow: glowShadow,
    light: { background: '#fbf7ff', foreground: '#1a0b2e', card: '#ffffff', primary: '#c0168a', 'primary-foreground': '#ffffff', secondary: '#f1e8fb', 'muted-foreground': '#66557c', accent: '#fde0f3', 'accent-foreground': '#930f69', border: '#e6d8f5' },
    dark: { background: '#0b0414', foreground: '#f5ecff', card: '#160a26', primary: '#ff3fbf', 'primary-foreground': '#160018', secondary: '#23133b', 'muted-foreground': '#ac9ac6', accent: '#3d1040', 'accent-foreground': '#ff9ce0', border: '#3a2360' }
  },
  atardecer: {
    label: 'Atardecer',
    description: 'Cálido: terracota, crema y serifa con carácter.',
    inspiredBy: 'Claude / Mocha Mousse',
    fonts: { display: ['Fraunces Variable', 'Georgia', 'serif'] },
    load: ['fraunces'],
    radius: 14,
    signalHue: 80,
    shadow: softShadow('#3b2414'),
    light: { background: '#faf5ee', foreground: '#2b1d14', card: '#fffcf7', primary: '#b4471f', 'primary-foreground': '#fffaf3', secondary: '#f1e7da', 'muted-foreground': '#715c4b', accent: '#f8dfcb', 'accent-foreground': '#8a3413', border: '#e6d7c4' },
    dark: { background: '#1a120d', foreground: '#f6ebde', card: '#241a13', primary: '#f08a5d', 'primary-foreground': '#1a120d', secondary: '#31251c', 'muted-foreground': '#bca590', accent: '#412c1e', 'accent-foreground': '#ffc29f', border: '#3f3024' }
  },
  oceano: {
    label: 'Océano',
    description: 'Fresco: azul profundo y coral.',
    inspiredBy: 'Ocean Breeze',
    radius: 16,
    shadow: softShadow('#0b2230'),
    light: { background: '#f2f8fb', foreground: '#0b2230', card: '#ffffff', primary: '#0b6e99', 'primary-foreground': '#ffffff', secondary: '#e1eef4', 'muted-foreground': '#486373', accent: '#d4ecf7', 'accent-foreground': '#08587b', border: '#cfe0e8' },
    dark: { background: '#06141c', foreground: '#e3f2f8', card: '#0c1f2a', primary: '#4cc3ee', 'primary-foreground': '#04121a', secondary: '#132c39', 'muted-foreground': '#91b2c2', accent: '#0f3446', 'accent-foreground': '#9fe0f7', border: '#1d3a48' }
  },
  chicle: {
    label: 'Chicle',
    description: 'Pastel y redondo: violeta suave y rosa.',
    inspiredBy: 'Soft Pop / Pastel Dreams',
    radius: 22,
    shadow: softShadow('#4a2b7a'),
    light: { background: '#fdf7fb', foreground: '#2a1f3d', card: '#ffffff', primary: '#7446d4', 'primary-foreground': '#ffffff', secondary: '#f3ecfb', 'muted-foreground': '#675c80', accent: '#ffe3f1', 'accent-foreground': '#9c2d6a', border: '#eadff5' },
    dark: { background: '#17121f', foreground: '#f4edfc', card: '#211b2c', primary: '#b79bff', 'primary-foreground': '#17121f', secondary: '#2b2339', 'muted-foreground': '#ab9fc1', accent: '#3b2541', 'accent-foreground': '#ffb3d9', border: '#382d49' }
  },
  brutal: {
    label: 'Brutal',
    description: 'Neobrutalismo: esquinas rectas y sombras duras.',
    inspiredBy: 'Neo Brutalism',
    fonts: { display: ['Space Grotesk Variable', 'Segoe UI', 'system-ui', 'sans-serif'], body: ['Space Grotesk Variable', 'Segoe UI', 'system-ui', 'sans-serif'] },
    load: ['space-grotesk'],
    radius: 0,
    signalHue: 95,
    domainChroma: 1.1,
    shadow: hardShadow,
    light: { background: '#fff6d6', foreground: '#000000', card: '#ffffff', primary: '#1f3bff', 'primary-foreground': '#ffffff', secondary: '#ffe98a', 'muted-foreground': '#3d3d3d', accent: '#c9f0ff', 'accent-foreground': '#00293d', border: '#000000' },
    dark: { background: '#111111', foreground: '#fafafa', card: '#1c1c1c', primary: '#ffd400', 'primary-foreground': '#000000', secondary: '#2a2a2a', 'muted-foreground': '#b5b5b5', accent: '#14324a', 'accent-foreground': '#c9f0ff', border: '#fafafa' }
  }
};
const DEFAULT_THEME = 'sintonia';

/** Señal derivada del primario: tono complementario desplazado (o el fijado por el tema), con contraste comprobado. */
function deriveSignal(c, mode, hue) {
  const [, , ph] = hexToOklch(c.primary);
  const h = hue ?? (ph + 150) % 360;
  const signal = mode === 'dark' ? oklch(0.8, 0.15, h) : oklch(0.68, 0.18, h);
  return {
    signal,
    'signal-foreground': ensureContrast(mode === 'dark' ? oklch(0.82, 0.14, h) : oklch(0.52, 0.15, h), [c.background, c.card], mode),
    'signal-muted': mode === 'dark' ? oklch(0.27, 0.05, h) : oklch(0.95, 0.04, h)
  };
}

/** Los 23 colores semánticos de un tema en un modo. */
function resolveColors(id, mode) {
  const i = MODES.indexOf(mode);
  if (id === DEFAULT_THEME) return Object.fromEntries(Object.entries(semantic).map(([n, refs]) => [n, hexOf(refs[i])]));
  const m = themes[id][mode];
  const c = {
    background: m.background,
    foreground: m.foreground,
    card: m.card,
    'card-foreground': m.foreground,
    popover: m.card,
    'popover-foreground': m.foreground,
    primary: m.primary,
    'primary-foreground': m['primary-foreground'],
    secondary: m.secondary,
    'secondary-foreground': m.foreground,
    muted: m.secondary,
    'muted-foreground': m['muted-foreground'],
    accent: m.accent,
    'accent-foreground': m['accent-foreground'],
    destructive: FIXED.destructive[i],
    border: m.border,
    input: m.border,
    ring: m.primary
  };
  Object.assign(c, deriveSignal(c, mode, themes[id].signalHue));
  c.yes = FIXED.yes[i];
  c.no = FIXED.no[i];
  return Object.fromEntries(Object.keys(semantic).map((n) => [n, c[n].toLowerCase()]));
}

const resolved = Object.fromEntries(
  Object.keys(themes).map((id) => {
    const t = themes[id];
    const modes = Object.fromEntries(
      MODES.map((mode, i) => {
        const colors = resolveColors(id, mode);
        const domains = Object.fromEntries(
          Object.entries(domainBase).map(([d, base]) => [d, ensureContrast(base[i], [colors.background, colors.card], mode, 4.5, t.domainChroma ?? 1)])
        );
        return [mode, { colors, domains, shadow: t.shadow(mode, colors) }];
      })
    );
    return [id, { ...t, fonts: { ...fonts, ...t.fonts }, radius: t.radius ?? radius.md, modes }];
  })
);

// ---------- Contraste WCAG ----------
const TEXT_PAIRS = [
  ['foreground', 'background'], ['foreground', 'card'], ['muted-foreground', 'background'], ['muted-foreground', 'card'],
  ['primary-foreground', 'primary'], ['secondary-foreground', 'secondary'], ['accent-foreground', 'accent'],
  ['signal-foreground', 'background'], ['signal-foreground', 'card']
];
// Sí/No son fijos: se avisa si en algún tema quedan justos, sin fallar.
const SOFT_PAIRS = [['muted-foreground', 'secondary'], ['yes', 'card'], ['no', 'card'], ['primary', 'background']];
const failures = [];
const warnings = [];
for (const [id, t] of Object.entries(resolved)) {
  for (const mode of MODES) {
    const { colors: c, domains } = t.modes[mode];
    for (const [fg, bg] of TEXT_PAIRS) {
      const r = contrast(c[fg], c[bg]);
      if (r < 4.5) failures.push(`${id}/${mode}: ${fg} sobre ${bg} = ${r.toFixed(2)}`);
    }
    for (const [fg, bg] of SOFT_PAIRS) {
      const r = contrast(c[fg], c[bg]);
      if (r < (fg === 'primary' ? 3 : 4.5)) warnings.push(`${id}/${mode}: ${fg} sobre ${bg} = ${r.toFixed(2)}`);
    }
    for (const [d, v] of Object.entries(domains)) {
      const r = Math.min(contrast(v, c.background), contrast(v, c.card));
      if (r < 4.5) failures.push(`${id}/${mode}: dominio ${d} = ${r.toFixed(2)}`);
    }
  }
}
if (warnings.length) console.warn('Aviso de contraste (no bloquea):\n  ' + warnings.join('\n  '));
if (failures.length) {
  console.error('Contraste insuficiente (WCAG AA, 4.5:1):\n  ' + failures.join('\n  '));
  process.exit(1);
}

// ---------- tokens.json ----------
const hexToColor = (hex, alpha = 1) => {
  const h = hex.replace('#', '').toLowerCase();
  const c = [0, 2, 4].map((i) => Math.round((parseInt(h.slice(i, i + 2), 16) / 255) * 10000) / 10000);
  const v = { colorSpace: 'srgb', components: c, hex: '#' + h };
  if (alpha !== 1) v.alpha = alpha;
  return v;
};
const px = (n) => ({ value: n, unit: 'px' });
const r3 = (n) => Math.round(n * 1000) / 1000;
const shadowToken = (layers) => layers.map(([x, y, b, s, col, a]) => ({ color: hexToColor(col, r3(a)), offsetX: px(x), offsetY: px(y), blur: px(b), spread: px(s) }));
const modesExt = (dark) => ({ 'app.sintonia.modes': { dark } });

const tokens = {
  $schema: 'https://www.designtokens.org/schemas/2025.10/format.json',
  $description: 'Tokens de diseño de Sintonía (Proyecto X). Los semánticos usan los nombres de shadcn/ui; el modo oscuro va en $extensions. Los temas alternativos van en el grupo theme.',
  color: {
    $type: 'color',
    ...Object.fromEntries(Object.entries(palette).map(([g, steps]) => [g, Object.fromEntries(Object.entries(steps).map(([k, v]) => [k, { $value: hexToColor(v) }]))])),
    semantic: Object.fromEntries(Object.entries(semantic).map(([name, [l, d]]) => [name, { $value: `{color.${l}}`, $extensions: modesExt(`{color.${d}}`) }]))
  },
  font: {
    family: { $type: 'fontFamily', ...Object.fromEntries(Object.entries(fonts).map(([k, v]) => [k, { $value: v }])) },
    weight: { $type: 'fontWeight', regular: { $value: 400 }, bold: { $value: 700 }, black: { $value: 800 } },
    size: { $type: 'dimension', ...Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, { $value: px(v) }])) },
    lineHeight: { $type: 'number', tight: { $value: 1.1 }, snug: { $value: 1.3 }, normal: { $value: 1.55 } }
  },
  typography: {
    $type: 'typography',
    display: { $value: { fontFamily: '{font.family.display}', fontWeight: '{font.weight.black}', fontSize: '{font.size.4xl}', lineHeight: '{font.lineHeight.tight}', letterSpacing: { value: -0.02, unit: 'rem' } } },
    question: { $value: { fontFamily: '{font.family.display}', fontWeight: '{font.weight.black}', fontSize: '{font.size.3xl}', lineHeight: '{font.lineHeight.tight}', letterSpacing: { value: -0.01, unit: 'rem' } } },
    body: { $value: { fontFamily: '{font.family.body}', fontWeight: '{font.weight.regular}', fontSize: '{font.size.base}', lineHeight: '{font.lineHeight.normal}', letterSpacing: { value: 0, unit: 'rem' } } },
    data: { $value: { fontFamily: '{font.family.mono}', fontWeight: '{font.weight.regular}', fontSize: '{font.size.sm}', lineHeight: '{font.lineHeight.snug}', letterSpacing: { value: 0, unit: 'rem' } } }
  },
  space: { $type: 'dimension', ...Object.fromEntries(Object.entries(space).map(([k, v]) => [k, { $value: px(v) }])) },
  radius: { $type: 'dimension', ...Object.fromEntries(Object.entries(radius).map(([k, v]) => [k, { $value: px(v) }])) },
  shadow: {
    $type: 'shadow',
    ...Object.fromEntries(Object.entries(shadows).map(([k, [x, y, b, s, a]]) => [k, { $value: { color: hexToColor('#131628', a), offsetX: px(x), offsetY: px(y), blur: px(b), spread: px(s) } }]))
  },
  motion: {
    duration: { $type: 'duration', fast: { $value: { value: 120, unit: 'ms' } }, base: { $value: { value: 200, unit: 'ms' } } },
    easing: { $type: 'cubicBezier', standard: { $value: [0.2, 0.8, 0.2, 1] } }
  },
  theme: {
    $description: `Sets de tema (selector 🎨). "${DEFAULT_THEME}" es el de por defecto. Cada set tiene sus colores semánticos (claro en $value, oscuro en $extensions), el color de cada temática ajustado a WCAG AA, fuentes, radio y sombras.`,
    ...Object.fromEntries(
      Object.entries(resolved).map(([id, t]) => {
        const { light, dark } = t.modes;
        return [
          id,
          {
            $description: t.description,
            $extensions: { 'app.sintonia.theme': { label: t.label, ...(t.inspiredBy ? { inspiredBy: `tweakcn: ${t.inspiredBy}` } : {}) } },
            color: {
              $type: 'color',
              ...Object.fromEntries(Object.keys(semantic).map((n) => [n, { $value: hexToColor(light.colors[n]), $extensions: modesExt(hexToColor(dark.colors[n])) }])),
              domain: Object.fromEntries(Object.keys(domainBase).map((d) => [d, { $value: hexToColor(light.domains[d]), $extensions: modesExt(hexToColor(dark.domains[d])) }]))
            },
            font: { $type: 'fontFamily', display: { $value: t.fonts.display }, body: { $value: t.fonts.body } },
            radius: { $type: 'dimension', $value: px(t.radius) },
            shadow: {
              $type: 'shadow',
              ...Object.fromEntries(Object.keys(light.shadow).map((k) => [k, { $value: shadowToken(light.shadow[k]), $extensions: modesExt(shadowToken(dark.shadow[k])) }]))
            }
          }
        ];
      })
    )
  }
};
writeFileSync(join(out, 'tokens.json'), JSON.stringify(tokens, null, 2) + '\n');

// ---------- theme.css ----------
const fam = (a) => a.map((f) => (f.includes(' ') ? `"${f}"` : f)).join(', ');
const rgbCss = (hex, a) => `rgb(${hexToRgb(hex).map((v) => Math.round(v * 255)).join(' ')} / ${r3(a)})`;
const shadowCss = (layers) => layers.map(([x, y, b, s, col, a]) => `${x}px ${y}px ${b}px ${s}px ${a === 1 ? col : rgbCss(col, a)}`).join(', ');
const lines = ['/* Generado por gen-tokens.mjs junto con tokens.json: cambia los tokens, no este archivo. */', '@custom-variant dark (&:where(.dark, .dark *));', ''];
const block = (selector, decls) => { lines.push(`${selector} {`, ...decls.map((d) => `  ${d}`), '}', ''); };
const modeDecls = (t, mode, withShape) => {
  const m = t.modes[mode];
  const d = Object.entries(m.colors).map(([n, v]) => `--${n}: ${v};`);
  if (withShape) d.push(`--radius: ${t.radius}px;`, `--display-font: ${fam(t.fonts.display)};`, `--body-font: ${fam(t.fonts.body)};`, `--mono-font: ${fam(t.fonts.mono)};`);
  for (const [k, layers] of Object.entries(m.shadow)) d.push(`--elevation-${k}: ${shadowCss(layers)};`);
  return d;
};
// El tema va en <html data-theme> y el modo en <html class="dark">. Especificidad: :root (0,1,0) < .dark (0,1,0, después)
// < :root[data-theme] (0,2,0) < :root.dark[data-theme] (0,3,0), así que cada tema pisa al de por defecto en los dos modos.
for (const [id, t] of Object.entries(resolved)) {
  const isDefault = id === DEFAULT_THEME;
  const light = isDefault ? ':root' : `:root[data-theme='${id}']`;
  const dark = isDefault ? '.dark' : `:root.dark[data-theme='${id}']`;
  lines.push(`/* ${t.label}: ${t.description}${t.inspiredBy ? ` Inspirado en tweakcn (${t.inspiredBy}).` : ''} */`);
  block(light, modeDecls(t, 'light', true));
  block(dark, modeDecls(t, 'dark', false));
  // Color de cada temática: lo fija [data-domain] en el marco y en cada tarjeta del selector.
  for (const d of Object.keys(domainBase)) {
    lines.push(`${isDefault ? '' : light + ' '}[data-domain='${d}'] { --domain: ${t.modes.light.domains[d]}; }`);
    lines.push(`${dark} [data-domain='${d}'] { --domain: ${t.modes.dark.domains[d]}; }`);
  }
  lines.push('');
}
lines.push('@theme inline {');
for (const n of Object.keys(semantic)) lines.push(`  --color-${n}: var(--${n});`);
lines.push('');
for (const k of Object.keys(fonts)) lines.push(`  --font-${k}: var(--${k}-font);`);
for (const [k, v] of Object.entries(sizes)) lines.push(`  --text-${k}: ${v / 16}rem;`);
lines.push('  --spacing: 0.25rem;');
lines.push('  --radius-sm: max(0px, calc(var(--radius) - 6px));', '  --radius-md: var(--radius);', '  --radius-lg: calc(var(--radius) + 8px);', '  --radius-xl: calc(var(--radius) + 12px);');
for (const k of Object.keys(resolved[DEFAULT_THEME].modes.light.shadow)) lines.push(`  --shadow-${k}: var(--elevation-${k});`);
lines.push('  --ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);');
lines.push('}', '');
writeFileSync(join(out, 'theme.css'), lines.join('\n'));

// ---------- themes.json: lo que necesita el menú de temas en la web ----------
const menu = Object.entries(resolved).map(([id, t]) => ({
  id,
  label: t.label,
  description: t.description,
  ...(t.inspiredBy ? { inspiredBy: t.inspiredBy } : {}),
  fonts: t.load ?? [],
  modes: Object.fromEntries(
    MODES.map((mode) => {
      const c = t.modes[mode].colors;
      return [mode, { swatches: [c.background, c.primary, c.signal, c.accent], themeColor: mode === 'dark' ? c.background : c.primary }];
    })
  )
}));
writeFileSync(join(out, 'themes.json'), JSON.stringify({ default: DEFAULT_THEME, themes: menu }, null, 2) + '\n');
console.log(`ok: ${menu.length} temas`);
