// Respaldo sin IA para el ánimo del texto inicial: frases muy comunes ("para entrenar",
// "sin letra", "para reírme") → nivel de una escala del dominio. Solo rellena lo que la IA no
// dijo (o todo, si no hay IA). Lógica pura, sin IA ni base de datos.
import type { DomainConfig } from '../domains/domain.types.js';
import { normalize } from './interview.engine.js';
import type { Understanding } from './interview.types.js';

interface Cue {
  pattern: RegExp;
  key: string;
  level: 'low' | 'high';
}

const MUSIC: Cue[] = [
  { pattern: /\b(entren\w*|gimnasio|gym|correr|deporte|pesas|crossfit|motivarme)\b/, key: 'energy', level: 'high' },
  { pattern: /\b(fiesta|perrear|perreo|bailar|discoteca|previa)\b/, key: 'dance', level: 'high' },
  { pattern: /\b(fiesta|perrear|perreo|previa|activarme|subidon)\b/, key: 'energy', level: 'high' },
  { pattern: /\b(estudi\w*|concentr\w*|trabaj\w*|programar|leer|de fondo)\b/, key: 'focus', level: 'high' },
  { pattern: /\b(relaj\w*|dormir|descansar|tranquil\w*|calma|chill)\b/, key: 'energy', level: 'low' },
  { pattern: /\b(sin letra|sin voz|instrumental\w*)\b/, key: 'vocal', level: 'low' },
  { pattern: /\b(para cantar|cantar|con letra)\b/, key: 'vocal', level: 'high' },
  { pattern: /\b(triste|bajon|melancol\w*|llorar)\b/, key: 'positivity', level: 'low' },
  { pattern: /\b(alegre|feliz|animad\w*|buen rollo)\b/, key: 'positivity', level: 'high' },
];

const CUES: Record<string, Cue[]> = {
  music: MUSIC,
  youtube: MUSIC,
  folder: MUSIC,
  movies: [
    { pattern: /\b(reir\w*|risas|comedia|divertid\w*)\b/, key: 'humor', level: 'high' },
    { pattern: /\b(cansad\w*|reventad\w*|desconectar|sin pensar)\b/, key: 'depth', level: 'low' },
    { pattern: /\b(pensar|profund\w*|reflexion\w*)\b/, key: 'depth', level: 'high' },
    { pattern: /\b(romantic\w*|amor)\b/, key: 'romance', level: 'high' },
    { pattern: /\b(ninos|familia|peques)\b/, key: 'family', level: 'high' },
    { pattern: /\b(tension|adrenalina|trepidante)\b/, key: 'pace', level: 'high' },
  ],
  books: [
    { pattern: /\b(liger\w*|facil|cansad\w*|desconectar)\b/, key: 'lightness', level: 'high' },
    { pattern: /\b(enganche|enganchar|no pueda soltar)\b/, key: 'pace', level: 'high' },
    { pattern: /\b(corto|rapido de leer)\b/, key: 'length', level: 'low' },
    { pattern: /\b(aprender|ensayo|divulgacion)\b/, key: 'fiction', level: 'low' },
  ],
  games: [
    { pattern: /\b(tranquil\w*|relaj\w*|desconectar|cansad\w*)\b/, key: 'intensity', level: 'low' },
    { pattern: /\b(adrenalina|accion|frenetic\w*)\b/, key: 'intensity', level: 'high' },
    { pattern: /\b(amigos|cooperativo|multijugador|en compania)\b/, key: 'social', level: 'high' },
    { pattern: /\b(reto|dificil|exigente)\b/, key: 'challenge', level: 'high' },
    { pattern: /\b(historia|narrativ\w*)\b/, key: 'story', level: 'high' },
  ],
};

/** Señales de ánimo por reglas, con confianza 0,7 (cuentan como resueltas). */
export function cueMoods(domainId: string, text: string, config: DomainConfig): Understanding['moods'] {
  const t = ` ${normalize(text)} `;
  const scales = new Set(config.attributes.filter((a) => a.kind === 'scale').map((a) => a.key));
  const out: Understanding['moods'] = [];
  for (const cue of CUES[domainId] ?? []) {
    // "nada de terror" / "sin letra" ya llevan el "sin" en el patrón; las demás no cuentan negadas.
    const m = cue.pattern.exec(t);
    if (!m || !scales.has(cue.key) || out.some((o) => o.key === cue.key)) continue;
    const before = t.slice(Math.max(0, m.index - 12), m.index);
    if (!cue.pattern.source.includes('sin ') && /\b(no|nada de|sin)\s+$/.test(before)) continue;
    out.push({ key: cue.key, level: cue.level, confidence: 0.7 });
  }
  return out;
}

/** Completa el ánimo que entendió la IA con el de las reglas (la IA gana si dijo algo de esa escala). */
export function withCues(understood: Understanding, domainId: string, text: string, config: DomainConfig): Understanding {
  const cues = cueMoods(domainId, text, config).filter((c) => !understood.moods.some((m) => m.key === c.key));
  return cues.length ? { ...understood, moods: [...understood.moods, ...cues] } : understood;
}
