// Genera tokens.json (W3C DTCG 2025.10), theme.css (Tailwind v4 + shadcn/ui) y themes.json (menú de temas).
// Uso: node gen-tokens.mjs [carpeta]  (por defecto, la carpeta de este paquete)
// Comprueba el contraste WCAG de cada tema en claro y oscuro: si una pareja de texto no llega a AA, falla.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BASE_FONTS, FONT_CHOICES, MODES, SOFT_PAIRS, contrast, deriveColors, domainBase, failingPairs, glowShadow, hardShadow,
  menuModes, r3, resolveDomains, shadowCss, softShadow, themeCssLines
} from './theme-engine.mjs';

const out = process.argv[2] ?? dirname(fileURLToPath(import.meta.url));
mkdirSync(out, { recursive: true });


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

const fonts = BASE_FONTS;
const sizes = { xs: 12, sm: 14, base: 16, lg: 20, xl: 25, '2xl': 31, '3xl': 39, '4xl': 49 };
const space = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48, 16: 64 };
const radius = { sm: 6, md: 12, lg: 20, full: 999 };
const shadows = {
  sm: [0, 1, 2, 0, 0.08],
  md: [0, 4, 12, -2, 0.12],
  lg: [0, 12, 32, -8, 0.18]
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
    font: 'inter',
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
    font: 'unbounded',
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
    font: 'fraunces',
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
    font: 'space-grotesk',
    radius: 0,
    signalHue: 95,
    domainChroma: 1.1,
    shadow: hardShadow,
    light: { background: '#fff6d6', foreground: '#000000', card: '#ffffff', primary: '#1f3bff', 'primary-foreground': '#ffffff', secondary: '#ffe98a', 'muted-foreground': '#3d3d3d', accent: '#c9f0ff', 'accent-foreground': '#00293d', border: '#000000' },
    dark: { background: '#111111', foreground: '#fafafa', card: '#1c1c1c', primary: '#ffd400', 'primary-foreground': '#000000', secondary: '#2a2a2a', 'muted-foreground': '#b5b5b5', accent: '#14324a', 'accent-foreground': '#c9f0ff', border: '#fafafa' }
  }
};
const DEFAULT_THEME = 'sintonia';


/** Los 23 colores semánticos de un tema en un modo. */
function resolveColors(id, mode) {
  if (id === DEFAULT_THEME) return Object.fromEntries(Object.entries(semantic).map(([n, refs]) => [n, hexOf(refs[MODES.indexOf(mode)])]));
  const derived = deriveColors(themes[id][mode], mode, themes[id].signalHue);
  return Object.fromEntries(Object.keys(semantic).map((n) => [n, derived[n]]));
}

const resolved = Object.fromEntries(
  Object.keys(themes).map((id) => {
    const t = themes[id];
    const modes = Object.fromEntries(
      MODES.map((mode) => {
        const colors = resolveColors(id, mode);
        const domains = resolveDomains(colors, mode, t.domainChroma ?? 1);
        return [mode, { colors, domains, shadow: t.shadow(mode, colors) }];
      })
    );
    return [id, { ...t, fonts: { ...fonts, ...FONT_CHOICES[t.font ?? 'sintonia'].fonts }, load: FONT_CHOICES[t.font ?? 'sintonia'].load, radius: t.radius ?? radius.md, modes }];
  })
);

// ---------- Contraste WCAG ----------
const failures = [];
const warnings = [];
for (const [id, t] of Object.entries(resolved)) {
  for (const mode of MODES) {
    const { colors: c, domains } = t.modes[mode];
    failures.push(...failingPairs(c, domains).map((m) => `${id}/${mode}: ${m}`));
    for (const [fg, bg] of SOFT_PAIRS) {
      const r = contrast(c[fg], c[bg]);
      if (r < (fg === 'primary' ? 3 : 4.5)) warnings.push(`${id}/${mode}: ${fg} sobre ${bg} = ${r.toFixed(2)}`);
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
const lines = ['/* Generado por gen-tokens.mjs junto con tokens.json: cambia los tokens, no este archivo. */', '@custom-variant dark (&:where(.dark, .dark *));', ''];
// < :root[data-theme] (0,2,0) < :root.dark[data-theme] (0,3,0), así que cada tema pisa al de por defecto en los dos modos.
for (const [id, t] of Object.entries(resolved)) {
  const isDefault = id === DEFAULT_THEME;
  lines.push(`/* ${t.label}: ${t.description}${t.inspiredBy ? ` Inspirado en tweakcn (${t.inspiredBy}).` : ""} */`);
  lines.push(...themeCssLines(id, t, isDefault), '');
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
  modes: menuModes(t)
}));
writeFileSync(join(out, 'themes.json'), JSON.stringify({ default: DEFAULT_THEME, themes: menu }, null, 2) + '\n');
console.log(`ok: ${menu.length} temas`);
