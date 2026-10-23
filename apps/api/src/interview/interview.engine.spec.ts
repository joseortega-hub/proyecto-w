import { musicDomain } from '../domains/music.domain.js';
import {
  answerChips,
  applyRefinements,
  mustFinish,
  profileConfidence,
  rankCandidates,
  remainingProbes,
} from './interview.engine.js';
import type { InterviewTurn, MoodProfile } from './interview.types.js';

const config = musicDomain.config;
const turn = (probeId: string, answer: InterviewTurn['answer']): InterviewTurn => ({ probeId, text: '', reason: '', answer });

describe('motor de entrevista', () => {
  it('la confianza crece con las dimensiones cubiertas y "No lo sé" no suma', () => {
    const a = profileConfidence([turn('focus', 'yes')], config);
    const b = profileConfidence([turn('focus', 'yes'), turn('vocal', 'no')], config);
    const c = profileConfidence([turn('focus', 'yes'), turn('vocal', 'unknown')], config);
    expect(b).toBeGreaterThan(a);
    expect(c).toBe(a);
  });

  it('las etiquetas reflejan las respuestas', () => {
    const chips = answerChips([turn('energy', 'no'), turn('vocal', 'no'), turn('happy', 'unknown')], config);
    expect(chips).toEqual(['tranquila', 'instrumental']);
  });

  it('no termina antes del mínimo y siempre termina en el máximo', () => {
    const three = ['focus', 'energy', 'vocal'].map((p) => turn(p, 'yes'));
    expect(mustFinish(three, config)).toBe(false);
    const ten = config.probes.slice(0, 10).map((p) => turn(p.id, 'unknown'));
    expect(mustFinish(ten, config)).toBe(true);
  });

  it('no repite preguntas', () => {
    const left = remainingProbes([turn('focus', 'yes')], config);
    expect(left.find((p) => p.id === 'focus')).toBeUndefined();
  });
});

describe('ranking', () => {
  const profile: MoodProfile = {
    scales: { energy: 0.2, positivity: 0.5, focus: 0.9, acoustic: 0.7, vocal: 0.05, dance: 0.2 },
    tagGroups: { urban: 0.1, calm: 0.9 },
    informed: ['energy', 'focus', 'vocal'],
    summary: [],
  };
  const item = (id: string, subtitle: string, attributes: Record<string, number>, tags: string[] = []) => ({
    id,
    subtitle,
    attributes,
    tags,
    popularity: 0.5,
  });
  const calm = item('calm', 'A', { energy: 0.2, positivity: 0.5, focus: 0.9, acoustic: 0.8, vocal: 0.05, dance: 0.1 }, ['piano']);
  const loud = item('loud', 'B', { energy: 0.9, positivity: 0.7, focus: 0.1, acoustic: 0.1, vocal: 0.9, dance: 0.9 }, ['reggaeton']);

  it('ordena por parecido con el perfil', () => {
    const [first] = rankCandidates([loud, calm], profile, config, 2);
    expect(first.item.id).toBe('calm');
  });

  it('limita los elementos por artista', () => {
    const many = [1, 2, 3].map((i) => ({ ...calm, id: `c${i}` }));
    expect(rankCandidates(many, profile, config, 10)).toHaveLength(2);
  });

  it('los ajustes mueven el perfil sin salirse de 0–1', () => {
    const refined = applyRefinements(profile, ['more-energy', 'more-energy', 'with-voice'], config);
    expect(refined.scales.energy).toBeCloseTo(0.6);
    expect(refined.scales.vocal).toBeCloseTo(0.4);
    expect(applyRefinements(profile, ['more-calm', 'more-calm'], config).scales.energy).toBe(0);
  });
});
