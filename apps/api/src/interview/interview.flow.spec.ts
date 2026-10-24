import { musicDomain } from '../domains/music.domain.js';
import { gamesDomain } from '../domains/games.domain.js';
import { tasteOnlyProbes } from '../taste/taste.engine.js';
import { minQuestions, mustFinish, profileConfidence, signalChips } from './interview.engine.js';
import { anchorsDone, askableProbes, assertNotAsked, autoAnswerExhausted } from './interview.flow.js';
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
    const offered = ids([turn('focus', 'no'), turn('workout', 'no'), turn('party', 'no'), turn('urban', 'no')]);
    expect(offered).toEqual(expect.arrayContaining(['electronic', 'rock', 'calm']));
  });

  it('música: las primeras preguntas son de momento o uso y los estilos van al final', () => {
    const moments = new Set(config.probes.filter((p) => p.moment).map((p) => p.id));
    expect(ids([]).every((id) => moments.has(id))).toBe(true);
    const styles = tasteOnlyProbes(config);
    const early = ids([turn('focus', 'no'), turn('workout', 'no')]);
    expect(early.some((id) => styles.has(id))).toBe(false);
    const late = [turn('focus', 'no'), turn('workout', 'no'), turn('party', 'no')];
    expect(ids(late).some((id) => styles.has(id))).toBe(true);
    // Con gustos o algo pedido, nunca.
    expect(askableProbes(late, config, { noStyles: true }).some((p) => styles.has(p.id))).toBe(false);
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

  it('lo que ya dejó claro el texto inicial no se pregunta y adelanta el final', () => {
    expect(ids([])).toContain('workout');
    const known = ['energy', 'dance'];
    const offered = askableProbes([], config, { known }).map((p) => p.id);
    expect(offered).not.toContain('workout');
    expect(offered).not.toContain('party');
    expect(profileConfidence([], config, known)).toBeGreaterThan(profileConfidence([], config));
    expect(minQuestions(config, known)).toBe(Math.max(3, config.interview.minQuestions - 2));
    expect(mustFinish([], config, known)).toBe(false);
    expect(signalChips({ energy: { value: 0.1, confidence: 0.9 } }, config)).toEqual(['tranquila']);
  });

  it('con gustos guardados no pregunta por estilos, salvo que no quede nada más', () => {
    const games = gamesDomain.config;
    const skip = tasteOnlyProbes(games);
    const offered = askableProbes([], games, { skip }).map((p) => p.id);
    expect(offered).not.toContain('rpg');
    expect(offered).toContain('story');
    const moodAsked = games.probes.filter((p) => !skip.has(p.id)).map((p) => turn(p.id, 'yes'));
    expect(askableProbes(moodAsked, games, { skip }).length).toBeGreaterThan(0);
  });
});

describe('respuestas automáticas', () => {
  const unknowns = (n: number) => Array.from({ length: n }, (_, i) => turn(`p${i}`, 'unknown'));

  it('termina con dos "no lo sé" seguidos cuando ya se cubrió el mínimo', () => {
    const min = minQuestions(config);
    expect(autoAnswerExhausted(unknowns(min - 1), 'unknown', config)).toBe(true);
  });

  it('sigue preguntando antes del mínimo, tras un "no lo sé" suelto o con una respuesta clara', () => {
    const min = minQuestions(config);
    expect(autoAnswerExhausted(unknowns(min - 2), 'unknown', config)).toBe(false);
    expect(autoAnswerExhausted([...unknowns(min - 2), turn('energy', 'yes')], 'unknown', config)).toBe(false);
    expect(autoAnswerExhausted(unknowns(min), 'yes', config)).toBe(false);
  });

  it('el mínimo baja con lo que ya dejó claro el texto', () => {
    expect(autoAnswerExhausted(unknowns(2), 'unknown', config, ['energy', 'vocal', 'mood'])).toBe(true);
  });
});

describe('fin anticipado con anclas', () => {
  it('termina cuando ya no hay preguntas que distingan lo pedido o no se pueden redactar', () => {
    expect(anchorsDone(1, true, 0, 3, 'exhausted')).toBe(true);
    expect(anchorsDone(1, true, 0, 2, 'exhausted')).toBe(false);
    expect(anchorsDone(1, true, 2, 5, 'exhausted')).toBe(false);
    expect(anchorsDone(1, false, 0, 2, 'unwritten')).toBe(true);
    expect(anchorsDone(1, false, 0, 1, 'unwritten')).toBe(false);
    expect(anchorsDone(0, true, 0, 9, 'exhausted')).toBe(false);
  });
});
