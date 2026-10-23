// Genera docs/design/tokens.json (W3C DTCG 2025.10) y docs/design/theme.css (Tailwind v4 + shadcn/ui)
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2];
mkdirSync(out, { recursive: true });

const hexToColor = (hex, alpha = 1) => {
  const h = hex.replace('#', '').toLowerCase();
  const c = [0, 2, 4].map((i) => Math.round((parseInt(h.slice(i, i + 2), 16) / 255) * 10000) / 10000);
  const v = { colorSpace: 'srgb', components: c, hex: '#' + h };
  if (alpha !== 1) v.alpha = alpha;
  return v;
};
const px = (n) => ({ value: n, unit: 'px' });

const palette = {
  neutral: { 0: '#FFFFFF', 25: '#ECEEF8', 50: '#F3F4F8', 100: '#E8EAF2', 200: '#D3D7E4', 400: '#9AA0BD', 600: '#5A607A', 700: '#2E3350', 800: '#20243C', 850: '#171A2E', 900: '#131628', 950: '#0E1020' },
  cobalt: { 100: '#E3E6FF', 200: '#C3C9FF', 300: '#8290FF', 600: '#3D4BF0', 700: '#2F3BC4', 900: '#252A57' },
  signal: { 100: '#FFE9DA', 300: '#FFA060', 500: '#E86A1C', 700: '#A5480C', 900: '#3A2A22' },
  green: { 400: '#3CCB92', 700: '#17855A' },
  rose: { 400: '#FF6E86', 600: '#C93A55' }
};

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

const fonts = {
  display: ['Bricolage Grotesque', 'Segoe UI', 'system-ui', 'sans-serif'],
  body: ['Atkinson Hyperlegible', 'Segoe UI', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'Cascadia Mono', 'ui-monospace', 'monospace']
};
const sizes = { xs: 12, sm: 14, base: 16, lg: 20, xl: 25, '2xl': 31, '3xl': 39, '4xl': 49 };
const space = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48, 16: 64 };
const radius = { sm: 6, md: 12, lg: 20, full: 999 };
const shadows = {
  sm: [0, 1, 2, 0, 0.08],
  md: [0, 4, 12, -2, 0.12],
  lg: [0, 12, 32, -8, 0.18]
};

const tokens = {
  $schema: 'https://www.designtokens.org/schemas/2025.10/format.json',
  $description: 'Tokens de diseño de Sintonía (Proyecto X). Los semánticos usan los nombres de shadcn/ui; el modo oscuro va en $extensions.',
  color: {
    $type: 'color',
    ...Object.fromEntries(Object.entries(palette).map(([g, steps]) => [g, Object.fromEntries(Object.entries(steps).map(([k, v]) => [k, { $value: hexToColor(v) }]))])),
    semantic: Object.fromEntries(Object.entries(semantic).map(([name, [l, d]]) => [name, { $value: `{color.${l}}`, $extensions: { 'app.sintonia.modes': { dark: `{color.${d}}` } } }]))
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
  }
};

writeFileSync(join(out, 'tokens.json'), JSON.stringify(tokens, null, 2) + '\n');

// theme.css
const hexOf = (ref) => { const [g, k] = ref.split('.'); return palette[g][k].toLowerCase(); };
const fam = (a) => a.map((f) => (f.includes(' ') ? `"${f}"` : f)).join(', ');
const shadowCss = ([x, y, b, s, a]) => `${x}px ${y}px ${b}px ${s}px rgb(19 22 40 / ${a})`;
const lines = [];
lines.push('/* Generado junto con tokens.json: cambia los tokens, no este archivo. */');
lines.push('@custom-variant dark (&:where(.dark, .dark *));', '');
lines.push(':root {');
for (const [n, [l]] of Object.entries(semantic)) lines.push(`  --${n}: ${hexOf(l)};`);
lines.push(`  --radius: ${radius.md}px;`);
lines.push('}', '', '.dark {');
for (const [n, [, d]] of Object.entries(semantic)) lines.push(`  --${n}: ${hexOf(d)};`);
lines.push('}', '', '@theme inline {');
for (const n of Object.keys(semantic)) lines.push(`  --color-${n}: var(--${n});`);
lines.push('');
for (const [k, v] of Object.entries(fonts)) lines.push(`  --font-${k}: ${fam(v)};`);
for (const [k, v] of Object.entries(sizes)) lines.push(`  --text-${k}: ${v / 16}rem;`);
lines.push('  --spacing: 0.25rem;');
lines.push(`  --radius-sm: ${radius.sm}px;`, '  --radius-md: var(--radius);', `  --radius-lg: ${radius.lg}px;`);
for (const [k, v] of Object.entries(shadows)) lines.push(`  --shadow-${k}: ${shadowCss(v)};`);
lines.push('  --ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);');
lines.push('}', '');
writeFileSync(join(out, 'theme.css'), lines.join('\n'));
console.log('ok');
