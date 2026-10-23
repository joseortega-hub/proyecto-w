import type { DomainDefinition } from './domain.types.js';

export const musicDomain: DomainDefinition = {
  id: 'music',
  name: 'Música',
  itemNoun: 'canción',
  itemNounPlural: 'canciones',
  config: {
    voice:
      'Recomiendas canciones del catálogo libre de Jamendo. Hablas de tú, en español de España, con frases cortas y cercanas.',
    attributes: [
      { key: 'energy', label: 'Energía', kind: 'scale', description: 'Intensidad y empuje de la música', lowLabel: 'tranquila', highLabel: 'enérgica' },
      { key: 'positivity', label: 'Positividad', kind: 'scale', description: 'Lo alegre o luminosa que suena', lowLabel: 'melancólica', highLabel: 'alegre' },
      { key: 'focus', label: 'Concentración', kind: 'scale', description: 'Lo bien que acompaña sin distraer', lowLabel: 'para escuchar', highLabel: 'para concentrarse' },
      { key: 'acoustic', label: 'Acústico', kind: 'scale', description: 'Instrumentos acústicos frente a sonidos electrónicos', lowLabel: 'electrónica', highLabel: 'acústica' },
      { key: 'vocal', label: 'Voz', kind: 'scale', description: 'Presencia de voz cantada', lowLabel: 'instrumental', highLabel: 'con voz' },
      { key: 'dance', label: 'Ritmo', kind: 'scale', description: 'Lo bailable que es', lowLabel: 'para escuchar quieto', highLabel: 'bailable' },
      { key: 'genres', label: 'Estilos', kind: 'tags', description: 'Géneros musicales' },
    ],
    tagGroups: [
      { key: 'urban', label: 'urbano y latino', tags: ['hiphop', 'rap', 'latin', 'reggaeton', 'rnb', 'trap', 'dancehall', 'reggae'] },
      { key: 'electronic', label: 'electrónica', tags: ['electronic', 'dance', 'house', 'techno', 'edm', 'electro', 'dubstep', 'chillout'] },
      { key: 'rock', label: 'rock y guitarras', tags: ['rock', 'metal', 'punk', 'indie', 'grunge', 'alternative'] },
      { key: 'calm', label: 'jazz, clásica y lounge', tags: ['jazz', 'classical', 'lounge', 'piano', 'blues', 'soundtrack', 'ambient'] },
    ],
    probes: [
      { id: 'focus', intent: 'Si la música es para trabajar o estudiar', informs: ['focus'], yesChip: 'para concentrarse', noChip: 'para disfrutar' },
      { id: 'energy', intent: 'Si le apetece moverse o algo con energía', informs: ['energy'], yesChip: 'con energía', noChip: 'tranquila' },
      { id: 'soft', intent: 'Si prefiere sonidos suaves', informs: ['energy', 'acoustic'], yesChip: 'suave', noChip: 'con cuerpo' },
      { id: 'vocal', intent: 'Si quiere que la música tenga voz', informs: ['vocal'], yesChip: 'con voz', noChip: 'instrumental' },
      { id: 'happy', intent: 'Si busca algo alegre y luminoso', informs: ['positivity'], yesChip: 'alegre', noChip: 'melancólica' },
      { id: 'dance', intent: 'Si le apetece bailar', informs: ['dance'], yesChip: 'bailable', noChip: 'sin bailar' },
      { id: 'party', intent: 'Si es para una fiesta o para estar con gente', informs: ['energy', 'dance'], yesChip: 'de fiesta', noChip: 'a solas' },
      { id: 'workout', intent: 'Si va a hacer deporte', informs: ['energy'], yesChip: 'para entrenar', noChip: 'sin deporte' },
      { id: 'acoustic', intent: 'Si prefiere instrumentos acústicos antes que sonidos electrónicos', informs: ['acoustic'], yesChip: 'acústica', noChip: 'electrónica' },
      { id: 'unwind', intent: 'Si quiere relajarse o desconectar', informs: ['energy', 'focus'], yesChip: 'para relajarse', noChip: 'sin relajarse' },
      { id: 'emotional', intent: 'Si le apetece algo emotivo o nostálgico', informs: ['positivity'], yesChip: 'emotiva', noChip: 'sin dramas' },
      { id: 'urban', intent: 'Si le apetece algo urbano o latino, como reguetón o hip hop', informs: ['genres'], yesChip: 'urbano', noChip: 'sin urbano' },
      { id: 'electronic', intent: 'Si le apetece música electrónica', informs: ['genres'], yesChip: 'electrónica', noChip: 'sin electrónica' },
      { id: 'rock', intent: 'Si le apetece rock o guitarras', informs: ['genres'], yesChip: 'rock', noChip: 'sin rock' },
      { id: 'calm', intent: 'Si le apetece jazz, clásica o lounge', informs: ['genres'], yesChip: 'jazz y clásica', noChip: 'sin clásica' },
    ],
    refinements: [
      { key: 'more-energy', label: '+ energía', attribute: 'energy', delta: 0.2 },
      { key: 'more-calm', label: '+ calma', attribute: 'energy', delta: -0.2 },
      { key: 'with-voice', label: 'con voz', attribute: 'vocal', delta: 0.35 },
      { key: 'instrumental', label: 'instrumental', attribute: 'vocal', delta: -0.35 },
    ],
    interview: { minQuestions: 4, maxQuestions: 10, confidenceToFinish: 0.8 },
    result: { candidates: 40, judged: 16, size: 12 },
  },
};

export const domainDefinitions: DomainDefinition[] = [musicDomain];
