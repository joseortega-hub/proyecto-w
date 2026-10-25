import type { DomainDefinition } from './domain.types.js';

export const musicDomain: DomainDefinition = {
  id: 'music',
  name: 'Música',
  itemNoun: 'canción',
  itemNounPlural: 'canciones',
  config: {
    voice:
      'Recomiendas canciones del catálogo libre de Jamendo. Hablas de tú, en español de España, con un tono cercano pero cuidado, como Spotify o Netflix, sin jerga ni coloquialismos y con frases cortas y cercanas.',
    gender: 'f',
    verb: 'escuchar',
    creatorLabel: 'artista',
    playable: true,
    source: {
      name: 'Jamendo',
      url: 'https://www.jamendo.com',
      attribution: 'Música de Jamendo con licencias Creative Commons.',
    },
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
      { id: 'focus', intent: 'Si la música es para estudiar o trabajar', informs: ['focus'], yesChip: 'para concentrarse', noChip: 'para disfrutar', moment: true },
      { id: 'workout', intent: 'Si va a entrenar o hacer deporte', informs: ['energy'], yesChip: 'para entrenar', noChip: 'sin deporte', moment: true },
      { id: 'party', intent: 'Si es para una fiesta o para estar con gente', informs: ['energy', 'dance'], yesChip: 'de fiesta', noChip: 'a solas', moment: true },
      { id: 'unwind', intent: 'Si quiere relajarse o desconectar', informs: ['energy', 'focus'], yesChip: 'para relajarse', noChip: 'sin relajarse', moment: true },
      { id: 'drive', intent: 'Si va a conducir o está de viaje', informs: ['energy', 'positivity'], yesChip: 'para el camino', noChip: 'sin coche', moment: true },
      { id: 'sing', intent: 'Si quiere canciones para cantar', informs: ['vocal', 'positivity'], yesChip: 'para cantar', noChip: 'de fondo', moment: true },
      { id: 'energy', intent: 'Si le apetece algo con energía', informs: ['energy'], yesChip: 'con energía', noChip: 'tranquila' },
      { id: 'soft', intent: 'Si prefiere algo suave y tranquilo', informs: ['energy', 'acoustic'], yesChip: 'suave', noChip: 'con cuerpo' },
      { id: 'vocal', intent: 'Si quiere que la música tenga letra', informs: ['vocal'], yesChip: 'con voz', noChip: 'instrumental' },
      { id: 'happy', intent: 'Si busca algo alegre', informs: ['positivity'], yesChip: 'alegre', noChip: 'melancólica' },
      { id: 'dance', intent: 'Si le apetece bailar', informs: ['dance'], yesChip: 'bailable', noChip: 'sin bailar' },
      { id: 'emotional', intent: 'Si le apetece algo que le emocione', informs: ['positivity'], yesChip: 'emotiva', noChip: 'sin dramas' },
      { id: 'urban', intent: 'Si le apetece reguetón o hip hop', informs: ['genres'], yesChip: 'urbano', noChip: 'sin urbano' },
      { id: 'electronic', intent: 'Si le apetece música electrónica', informs: ['genres'], yesChip: 'electrónica', noChip: 'sin electrónica' },
      { id: 'rock', intent: 'Si le apetece rock', informs: ['genres'], yesChip: 'rock', noChip: 'sin rock' },
      { id: 'calm', intent: 'Si le apetece jazz o clásica', informs: ['genres'], yesChip: 'jazz y clásica', noChip: 'sin clásica' },
    ],
    refinements: [
      { key: 'more-energy', label: '+ energía', attribute: 'energy', delta: 0.2 },
      { key: 'more-calm', label: '+ calma', attribute: 'energy', delta: -0.2 },
      { key: 'with-voice', label: 'con voz', attribute: 'vocal', delta: 0.35 },
      { key: 'instrumental', label: 'instrumental', attribute: 'vocal', delta: -0.35 },
    ],
    preferences: [
      {
        key: 'language',
        label: 'Idioma de la letra',
        options: [
          { value: 'es', label: 'Español', phrase: 'en español' },
          { value: 'en', label: 'Inglés', phrase: 'en inglés' },
          { value: 'any', label: 'Me da igual' },
        ],
        anyValue: 'any',
        alwaysPass: ['instrumental'],
        fillerLabel: 'instrumentales',
        guessInstructions: '¿En qué idioma quiere que estén cantadas las canciones? Si no lo dice ni se deduce, elige "any".',
      },
    ],
    // Se pregunta por el momento o el uso; los estilos, solo al final y si no hay gustos ni algo pedido.
    interview: { minQuestions: 4, maxQuestions: 10, confidenceToFinish: 0.8, momentFirst: 3, stylesLast: true },
    result: { candidates: 40, judged: 16, size: 12 },
  },
};
