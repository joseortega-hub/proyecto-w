// Tarjetas de «Tu año en Sintonía» como imagen PNG 9:16 (1080 × 1920): Satori (SVG) + resvg (PNG).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import type { YearCardKind, YearSummary } from './year.js';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;

/** Color de cada temática (como en la web). */
const ACCENT: Record<string, string> = { movies: '#ff5d6c', books: '#f0a63a', games: '#9b7bff', music: '#2fd38a' };
const RATING_WORD = { loved: 'Me encantó', liked: 'Bien', meh: 'Meh' } as const;

type Node = { type: string; props: Record<string, unknown> & { style?: Record<string, unknown>; children?: unknown } };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style: { display: 'flex', ...style }, children, ...extra },
});
const text = (value: string | number, style: Record<string, unknown> = {}) => h('div', { fontSize: 40, color: '#f4f1ff', ...style }, String(value));

let fonts: { name: string; data: Buffer; weight: 400 | 700; style: 'normal' }[] | null = null;
function loadFonts() {
  if (fonts) return fonts;
  const require = createRequire(import.meta.url);
  const file = (weight: number) => readFileSync(require.resolve(`@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-${weight}-normal.woff`));
  fonts = [
    { name: 'Atkinson', data: file(400), weight: 400, style: 'normal' },
    { name: 'Atkinson', data: file(700), weight: 700, style: 'normal' },
  ];
  return fonts;
}

/** Contenido de cada tarjeta (sin el marco). `covers` son portadas ya descargadas (data URI). */
function body(kind: YearCardKind, s: YearSummary, covers: Map<string, string>): Node {
  const accent = (id?: string) => ACCENT[id ?? ''] ?? '#c6b8ff';
  switch (kind) {
    case 'intro': {
      const stat = (n: number, label: string) =>
        h('div', { flexDirection: 'column', gap: 4 }, [text(n, { fontSize: 140, fontWeight: 700, color: '#ffffff' }), text(label, { fontSize: 44, color: '#c9c3e6' })]);
      return h('div', { flexDirection: 'column', gap: 56 }, [
        stat(s.totals.sessions, s.totals.sessions === 1 ? 'entrevista' : 'entrevistas'),
        stat(s.totals.recommended, 'recomendaciones'),
        ...(s.totals.seen ? [stat(s.totals.seen, 'ya vistos, leídos, jugados o escuchados')] : []),
      ]);
    }
    case 'domains': {
      const max = Math.max(...s.domains.map((d) => d.sessions * 2 + d.seen), 1);
      return h(
        'div',
        { flexDirection: 'column', gap: 48 },
        s.domains.map((d) =>
          h('div', { flexDirection: 'column', gap: 14 }, [
            text(d.name, { fontSize: 56, fontWeight: 700 }),
            h('div', { height: 28, width: `${Math.max(8, ((d.sessions * 2 + d.seen) / max) * 100)}%`, backgroundColor: accent(d.id), borderRadius: 14 }),
            text(`${d.sessions} ${d.sessions === 1 ? 'entrevista' : 'entrevistas'}${d.seen ? ` · ${d.seen} marcados` : ''}`, { fontSize: 36, color: '#c9c3e6' }),
          ]),
        ),
      );
    }
    case 'rated':
      return h(
        'div',
        { flexDirection: 'column', gap: 36 },
        s.topRated.map((r) =>
          h('div', { alignItems: 'center', gap: 32 }, [
            covers.get(r.title)
              ? { type: 'img', props: { src: covers.get(r.title), width: 150, height: 210, style: { borderRadius: 18, objectFit: 'cover' } } }
              : h('div', { width: 150, height: 210, borderRadius: 18, backgroundColor: accent(r.domainId) }),
            h('div', { flexDirection: 'column', gap: 8, flex: 1 }, [
              text(r.title, { fontSize: 48, fontWeight: 700, lineClamp: 2 }),
              ...(r.subtitle ? [text(r.subtitle, { fontSize: 34, color: '#c9c3e6' })] : []),
              text(RATING_WORD[r.rating], { fontSize: 34, color: accent(r.domainId), fontWeight: 700 }),
            ]),
          ]),
        ),
      );
    case 'creators':
      return h(
        'div',
        { flexDirection: 'column', gap: 44 },
        s.creators.map((c, i) =>
          h('div', { alignItems: 'baseline', gap: 28 }, [
            text(i + 1, { fontSize: 72, fontWeight: 700, color: accent(c.domainId), width: 70 }),
            h('div', { flexDirection: 'column', gap: 6, flex: 1 }, [text(c.name, { fontSize: 56, fontWeight: 700 }), text(`${c.count} veces`, { fontSize: 34, color: '#c9c3e6' })]),
          ]),
        ),
      );
    case 'words': {
      const max = Math.max(...s.words.map((w) => w.count), 1);
      return h(
        'div',
        { flexWrap: 'wrap', gap: 24 },
        s.words.map((w) =>
          h('div', { padding: '18px 34px', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', border: '3px solid rgba(255,255,255,0.25)' }, [
            text(w.word, { fontSize: 44 + Math.round((w.count / max) * 36), fontWeight: 700 }),
          ]),
        ),
      );
    }
    case 'vibe':
      return h('div', { flexDirection: 'column', gap: 46 }, [
        text(`${s.vibe!.sessions} ${s.vibe!.sessions === 1 ? 'entrevista' : 'entrevistas'} en ${s.vibe!.name.toLowerCase()}`, { fontSize: 38, color: '#c9c3e6' }),
        ...s.vibe!.bars.map((b) =>
          h('div', { flexDirection: 'column', gap: 14 }, [
            h('div', { justifyContent: 'space-between' }, [text(b.label, { fontSize: 46, fontWeight: 700 }), text(b.word ?? 'equilibrada', { fontSize: 36, color: '#c9c3e6' })]),
            h('div', { height: 26, width: '100%', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 13 }, [
              h('div', { height: 26, width: `${Math.max(4, b.value * 100)}%`, backgroundColor: accent(s.vibe!.domainId), borderRadius: 13 }),
            ]),
          ]),
        ),
      ]);
    case 'facts':
      return h(
        'div',
        { flexDirection: 'column', gap: 44 },
        s.facts.map((f) => h('div', { gap: 26, alignItems: 'flex-start' }, [h('div', { width: 22, height: 22, marginTop: 18, borderRadius: 11, backgroundColor: '#c6b8ff' }), text(f, { fontSize: 50, flex: 1 })])),
      );
  }
}

/** Árbol de Satori de una tarjeta completa (marco, titular y contenido). */
export function cardTree(kind: YearCardKind, s: YearSummary, headline: string, covers = new Map<string, string>()): Node {
  const accent = ACCENT[s.domains[0]?.id ?? ''] ?? '#c6b8ff';
  return h(
    'div',
    {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      flexDirection: 'column',
      padding: '120px 96px 96px',
      backgroundColor: '#16122b',
      backgroundImage: `linear-gradient(160deg, #241b4d 0%, #16122b 55%, ${accent}55 100%)`,
      color: '#f4f1ff',
      fontFamily: 'Atkinson',
    },
    [
      text(`TU AÑO EN SINTONÍA · ${s.year}`, { fontSize: 34, letterSpacing: 4, color: accent, fontWeight: 700 }),
      text(headline, { fontSize: 82, fontWeight: 700, lineHeight: 1.1, marginTop: 40, marginBottom: 80 }),
      h('div', { flexDirection: 'column', flex: 1 }, [body(kind, s, covers)]),
      text('Sintonía', { fontSize: 40, fontWeight: 700, color: '#c9c3e6' }),
    ],
  );
}

/** PNG de una tarjeta. */
export async function renderCard(kind: YearCardKind, s: YearSummary, headline: string, covers?: Map<string, string>): Promise<Buffer> {
  const svg = await satori(cardTree(kind, s, headline, covers) as never, { width: CARD_WIDTH, height: CARD_HEIGHT, fonts: loadFonts() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: CARD_WIDTH } }).render().asPng();
}
