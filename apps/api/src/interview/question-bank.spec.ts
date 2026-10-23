import { keywords, pickVariant, type BankVariant } from './question-bank.js';
import { asQuestion } from './question-bank.service.js';
import type { InterviewTurn } from './interview.types.js';

const asked = (text: string): InterviewTurn => ({ probeId: 'x', text, reason: '', answer: 'yes' });
const v = (variant: number, question: string): BankVariant => ({ variant, question, reason: '' });

describe('banco de preguntas', () => {
  it('extrae palabras con contenido, sin tildes ni palabras vacías', () => {
    expect([...keywords('¿Te apetece bailar música enérgica?')]).toEqual(['bailar', 'musica', 'energica']);
  });

  it('elige la variante que no repite palabras de las preguntas ya hechas', () => {
    const variants = [v(0, '¿Te apetece bailar ritmos urbanos?'), v(1, '¿Te va el reguetón o el hip hop?')];
    const chosen = pickVariant(variants, [asked('¿Te apetece bailar un poco?')], () => 0);
    expect(chosen?.variant).toBe(1);
  });

  it('sin preguntas previas, cualquiera vale; sin variantes, no hay banco', () => {
    expect(pickVariant([v(0, 'a'), v(1, 'b')], [], () => 0.99)?.variant).toBe(1);
    expect(pickVariant([], [])).toBeNull();
  });

  it('pone siempre los signos de interrogación', () => {
    expect(asQuestion('Te apetece bailar')).toBe('¿Te apetece bailar?');
    expect(asQuestion('¿Te apetece bailar?')).toBe('¿Te apetece bailar?');
  });
});
