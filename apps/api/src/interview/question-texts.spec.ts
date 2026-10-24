import { domainDefinitions } from '../domains/index.js';
import { checkQuestion, QUESTIONS } from './question-texts.js';

describe('banco de preguntas revisado', () => {
  it.each(domainDefinitions.map((d) => [d.id, d] as const))('%s: todas las sondas tienen al menos dos preguntas', (_id, domain) => {
    for (const probe of domain.config.probes) expect(QUESTIONS[domain.id]?.[probe.id]?.length ?? 0, `${domain.id}/${probe.id}`).toBeGreaterThanOrEqual(2);
  });

  it('cada pregunta es corta, sencilla y sin tecnicismos', () => {
    const bad = Object.entries(QUESTIONS).flatMap(([domain, probes]) =>
      Object.entries(probes).flatMap(([probe, questions]) => questions.flatMap((q) => (checkQuestion(q) ? [`${domain}/${probe}: «${q}» ${checkQuestion(q)}`] : []))),
    );
    expect(bad).toEqual([]);
  });

  it('el validador rechaza lo largo, lo rebuscado y lo que no es una pregunta', () => {
    expect(checkQuestion('¿Te apetece bailar?')).toBeNull();
    expect(checkQuestion('¿Quieres una cinta con mucho movimiento y riesgo?')).toMatch(/rebuscado/);
    expect(checkQuestion('¿Te apetece algo radiante que te suba la moral al instante y te anime mucho?')).toMatch(/palabras|rebuscado/);
    expect(checkQuestion('Te apetece bailar')).toMatch(/¿/);
    expect(checkQuestion('¿Te apetece? ¿Seguro?')).toMatch(/una sola/);
  });

  it('en música, las primeras preguntas son de momento o uso', () => {
    const music = domainDefinitions.find((d) => d.id === 'music')!;
    expect(music.config.interview.momentFirst).toBeGreaterThan(0);
    expect(music.config.probes.filter((p) => p.moment).length).toBeGreaterThanOrEqual(4);
  });
});
