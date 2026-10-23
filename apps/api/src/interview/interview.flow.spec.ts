import { musicDomain } from '../domains/music.domain.js';
import { askableProbes, assertNotAsked } from './interview.flow.js';
import type { InterviewTurn } from './interview.types.js';

const config = musicDomain.config;
const turn = (probeId: string, answer: InterviewTurn['answer']): InterviewTurn => ({ probeId, text: '', reason: '', answer });
const ids = (turns: InterviewTurn[]) => askableProbes(turns, config).map((p) => p.id);

describe('preguntas que se pueden hacer', () => {
  it('no vuelve a ofrecer una pregunta ya hecha, ni con "No lo sé" ni pendiente', () => {
    const offered = ids([turn('energy', 'unknown'), turn('vocal', null)]);
    expect(offered).not.toContain('energy');
    expect(offered).not.toContain('vocal');
  });

  it('descarta las redundantes: "fiesta" sobra si ya se sabe la energía y el baile', () => {
    expect(ids([turn('energy', 'yes')])).toContain('party');
    expect(ids([turn('energy', 'yes'), turn('dance', 'yes')])).not.toContain('party');
  });

  it('una pregunta respondida con "No lo sé" no resuelve su dimensión', () => {
    expect(ids([turn('energy', 'unknown'), turn('dance', 'yes')])).toContain('party');
  });

  it('las preguntas de estilo siguen disponibles aunque ya se haya preguntado por otro estilo', () => {
    const offered = ids([turn('urban', 'no')]);
    expect(offered).toEqual(expect.arrayContaining(['electronic', 'rock', 'calm']));
  });

  it('una entrevista completa nunca repite sondas', () => {
    const turns: InterviewTurn[] = [];
    for (let i = 0; i < 15; i++) {
      const [next] = askableProbes(turns, config);
      if (!next) break;
      assertNotAsked(turns, next.id);
      turns.push(turn(next.id, i % 2 ? 'yes' : 'no'));
    }
    expect(new Set(turns.map((t) => t.probeId)).size).toBe(turns.length);
  });

  it('assertNotAsked bloquea una sonda repetida', () => {
    expect(() => assertNotAsked([turn('vocal', 'yes')], 'vocal')).toThrow();
  });
});
