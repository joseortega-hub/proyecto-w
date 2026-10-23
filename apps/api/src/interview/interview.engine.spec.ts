import { musicDomain } from '../domains/music.domain.js';
import {
  answerChips,
  applyRefinements,
  fallbackReason,
  hybridRank,
  itemEmbeddingText,
  matchHints,
  matchPercent,
  mustFinish,
  percentiles,
  preferenceFilters,
  preferenceNotice,
  profileQueryText,
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
    confidence: {},
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

describe('búsqueda semántica', () => {
  const profile: MoodProfile = {
    scales: {
      energy: 0.15,
      positivity: 0.5,
      focus: 0.9,
      acoustic: 0.7,
      vocal: 0.05,
      dance: 0.2,
    },
    tagGroups: { urban: 0.1, calm: 0.9 },
    informed: ['energy', 'focus', 'vocal'],
    confidence: {},
    summary: ['para concentrarse', 'tranquila', 'instrumental'],
  };
  const song = (id: string, subtitle: string, attributes: Record<string, number>, tags: string[] = []) => ({
    id,
    title: id,
    subtitle,
    description: null,
    attributes,
    tags,
    popularity: 0.5,
  });
  const calm = song(
    'calm',
    'A',
    {
      energy: 0.2,
      positivity: 0.5,
      focus: 0.9,
      acoustic: 0.8,
      vocal: 0.05,
      dance: 0.1,
    },
    ['piano'],
  );
  const loud = song(
    'loud',
    'B',
    {
      energy: 0.9,
      positivity: 0.7,
      focus: 0.1,
      acoustic: 0.1,
      vocal: 0.9,
      dance: 0.9,
    },
    ['reggaeton'],
  );
  const mid = song('mid', 'C', {
    energy: 0.5,
    positivity: 0.5,
    focus: 0.5,
    acoustic: 0.5,
    vocal: 0.5,
    dance: 0.5,
  });

  it('el elemento y la consulta comparten vocabulario', () => {
    const doc = itemEmbeddingText(calm, config, 'canción');
    const query = profileQueryText(profile, config, 'canciones');
    for (const word of ['tranquila', 'instrumental', 'para concentrarse']) {
      expect(doc).toContain(word);
      expect(query).toContain(word);
    }
    expect(doc).toContain('jazz, clásica y lounge');
    expect(query).toContain('jazz, clásica y lounge');
    expect(query).not.toContain('urbano');
  });

  it('el texto inicial entra en la consulta como dato', () => {
    expect(profileQueryText(profile, config, 'canciones', 'cansado tras el curro')).toContain(
      'Cómo se siente: cansado tras el curro',
    );
  });

  it('los percentiles reparten valores apretados entre 0 y 1', () => {
    expect(percentiles([0.71, 0.72, 0.73])).toEqual([0, 0.5, 1]);
    expect(percentiles([0.7, 0.7])).toEqual([0.5, 0.5]);
    expect(percentiles([0.4])).toEqual([1]);
  });

  it('la similitud semántica puede reordenar el ranking por atributos', () => {
    const byAttributes = hybridRank(
      [calm, mid].map((item) => ({ item, semantic: null })),
      profile,
      config,
      2,
    );
    expect(byAttributes[0].item.id).toBe('calm');
    const semanticFirst = hybridRank(
      [
        { item: calm, semantic: 0.6 },
        { item: mid, semantic: 0.9 },
        { item: loud, semantic: 0.5 },
      ],
      profile,
      config,
      3,
      { semanticWeight: 0.8 },
    );
    expect(semanticFirst[0].item.id).toBe('mid');
    expect(semanticFirst.at(-1)?.item.id).toBe('loud');
  });

  it('el % de encaje usa todo el rango y respeta el orden', () => {
    expect(matchPercent(1, 1)).toBe(99);
    expect(matchPercent(0, 0)).toBe(40);
    expect(matchPercent(0.5, null)).toBe(70);
    const spread = [0, 0.25, 0.5, 0.75, 1].map((r) => matchPercent(r, r));
    expect(spread.at(-1)! - spread[0]).toBeGreaterThan(50);
    expect([...spread].sort((a, b) => a - b)).toEqual(spread);
  });

  it('siempre hay una explicación, aunque falle el modelo', () => {
    expect(matchHints(calm, profile, config)).toEqual(
      expect.arrayContaining(['tranquila', 'para concentrarse', 'instrumental', 'jazz, clásica y lounge']),
    );
    expect(fallbackReason(calm, profile, config)).toMatch(/tranquila/);
    expect(fallbackReason(loud, profile, config).length).toBeGreaterThan(10);
  });
});

describe('preferencias previas', () => {
  const es = { language: { value: 'es', source: 'user' as const, confidence: null } };
  const lang = (language: string) => ({ facets: { language } });

  it('filtra por el valor elegido y deja pasar siempre las instrumentales', () => {
    expect(preferenceFilters(es, config)).toEqual([{ key: 'language', values: ['es', 'instrumental'] }]);
  });

  it('"me da igual", un valor desconocido o nada elegido no filtran', () => {
    const any = { language: { value: 'any', source: 'user' as const, confidence: null } };
    const weird = { language: { value: 'xx', source: 'guess' as const, confidence: 0.4 } };
    expect(preferenceFilters(any, config)).toEqual([]);
    expect(preferenceFilters(weird, config)).toEqual([]);
    expect(preferenceFilters({}, config)).toEqual([]);
  });

  it('avisa cuando hay pocas en el idioma elegido y se completa con instrumentales', () => {
    const few = [...Array(3)].map(() => lang('es')).concat([...Array(9)].map(() => lang('instrumental')));
    expect(preferenceNotice(few, es, config, 'canciones', 12)).toBe(
      'En español solo tengo 3 canciones que encajen, así que te completo la lista con instrumentales.',
    );
    const none = [...Array(12)].map(() => lang('instrumental'));
    expect(preferenceNotice(none, es, config, 'canciones', 12)).toMatch(/^En español no tengo canciones/);
    expect(preferenceNotice(few.slice(0, 5), es, config, 'canciones', 12)).toMatch(/solo he encontrado 5/);
  });

  it('no avisa si hay suficientes o si no se filtró', () => {
    const enough = [...Array(8)].map(() => lang('es')).concat([...Array(4)].map(() => lang('instrumental')));
    expect(preferenceNotice(enough, es, config, 'canciones', 12)).toBeNull();
    expect(preferenceNotice([], {}, config, 'canciones', 12)).toBeNull();
  });
});
