// Banco de preguntas revisado a mano: español sencillo y cercano, de tú, como mucho 12 palabras
// y sin tecnicismos. Va en el código (no lo redacta la IA en directo), así que cada pregunta
// que ve la persona está aquí y pasa `checkQuestion` (ver question-texts.spec.ts).
import { normalize } from './interview.engine.js';

/** Máximo de palabras por pregunta. */
export const MAX_WORDS = 12;

/** Palabras que no deben salir en una pregunta: tecnicismos, jerga de la app o giros rebuscados. */
const JARGON =
  /\b(entropia|dimension|atributo|ganancia|candidat|faceta|vector|embedding|parametro|algoritmo|tempo|bpm|timbre|textura|atmosferic|minimalista|introspectiv|cinematograf|narrativa|onirico|eclectic|sonoridad|sonidos?|frecuencia|cinta|largometraje|propuesta|experiencia|vibrante|radiante|estimulante)/;

/** Por qué una pregunta no vale, o null si vale. */
export function checkQuestion(q: string): string | null {
  if (!/^¿[^¿?]+\?$/.test(q)) return 'debe ir entre ¿ y ? y ser una sola pregunta';
  const words = q.split(/\s+/).filter(Boolean).length;
  if (words > MAX_WORDS) return `tiene ${words} palabras (máximo ${MAX_WORDS})`;
  if (JARGON.test(normalize(q))) return 'usa un tecnicismo o un giro rebuscado';
  if (/^¿no\b/i.test(q)) return 'va en negativo';
  return null;
}

/** Preguntas de música: por el momento y el uso; los estilos, al final. Las comparten "Mi YouTube" y "Mi carpeta". */
const music: Record<string, string[]> = {
  focus: ['¿Es para estudiar o trabajar?', '¿La quieres de fondo mientras trabajas o estudias?'],
  workout: ['¿Vas a entrenar o hacer deporte?', '¿Es para el gimnasio o para correr?'],
  party: ['¿Es para una fiesta o para estar con gente?', '¿Vas a estar de fiesta con amigos?'],
  unwind: ['¿Quieres relajarte un rato?', '¿Es para desconectar y descansar?'],
  drive: ['¿Vas a conducir o estás de viaje?', '¿Es para escuchar en el coche?'],
  sing: ['¿Te apetece cantar a todo pulmón?', '¿Quieres canciones para cantar?'],
  energy: ['¿Te apetece algo con mucha energía?', '¿Quieres algo que te active?'],
  soft: ['¿Prefieres algo suave y tranquilo?', '¿Te va algo tranquilito?'],
  vocal: ['¿La quieres con letra?', '¿Te apetece que tenga voz?'],
  happy: ['¿Buscas algo alegre?', '¿Te apetece algo que te suba el ánimo?'],
  dance: ['¿Te apetece bailar?', '¿Quieres algo para mover el cuerpo?'],
  emotional: ['¿Te apetece algo que te emocione?', '¿Estás en modo nostálgico?'],
  urban: ['¿Te apetece reguetón o hip hop?', '¿Quieres algo urbano o latino?'],
  electronic: ['¿Te apetece música electrónica?', '¿Quieres algo electrónico para bailar?'],
  rock: ['¿Te apetece rock?', '¿Quieres algo con guitarras potentes?'],
  calm: ['¿Te apetece jazz o clásica?', '¿Quieres algo de piano, jazz o clásica?'],
  // Solo "Mi YouTube" y "Mi carpeta".
  perreo: ['¿Te apetece perreo, reguetón o trap?', '¿Quieres darle al perreo?'],
  tropical: ['¿Te apetece bachata o salsa?', '¿Quieres algo para bailar en pareja?'],
  pop: ['¿Te apetece pop o baladas?', '¿Quieres pop para cantar?'],
  hiphop: ['¿Te apetece rap, hip hop o R&B?', '¿Quieres algo de rap?'],
};

export const QUESTIONS: Record<string, Record<string, string[]>> = {
  music,
  youtube: music,
  folder: music,
  movies: {
    unwind: ['¿Quieres algo para desconectar sin pensar?', '¿Te apetece algo ligerito?'],
    laugh: ['¿Te apetece reírte un rato?', '¿Buscas una comedia?'],
    thrill: ['¿Quieres algo que te tenga en tensión?', '¿Te apetece una peli con mucho ritmo?'],
    feelgood: ['¿Quieres algo que te deje buen rollo?', '¿Buscas una peli alegre?'],
    cry: ['¿Te apetece emocionarte un poco?', '¿Estás para una peli que te toque?'],
    romance: ['¿Te apetece una historia de amor?', '¿Quieres algo romántico?'],
    company: ['¿La vas a ver con niños o en familia?', '¿Es para verla en familia?'],
    classic: ['¿Te apetece un clásico?', '¿Prefieres una peli antigua a un estreno?'],
    mindbend: ['¿Quieres una peli que te haga pensar?', '¿Te apetece que te vuele la cabeza?'],
    action: ['¿Te apetece acción o aventura?', '¿Quieres peleas, persecuciones y aventura?'],
    scary: ['¿Te apetece pasar miedo?', '¿Quieres una de terror?'],
    mystery: ['¿Te apetece un misterio o un crimen?', '¿Quieres resolver un misterio?'],
    scifi: ['¿Te apetece ciencia ficción o fantasía?', '¿Quieres naves, magia u otros mundos?'],
    animation: ['¿Te apetece una de dibujos animados?', '¿Quieres una peli de animación?'],
    real: ['¿Te apetece una historia real o un documental?', '¿Quieres algo basado en hechos reales?'],
  },
  books: {
    easy: ['¿Quieres algo fácil de leer?', '¿Te apetece una lectura ligera?'],
    hooked: ['¿Quieres un libro que te enganche?', '¿Buscas algo que no puedas soltar?'],
    bright: ['¿Te apetece algo optimista?', '¿Quieres una historia que te deje buen sabor?'],
    story: ['¿Prefieres una novela a un ensayo?', '¿Te apetece una historia inventada?'],
    short: ['¿Prefieres un libro corto?', '¿Quieres algo que se lea rápido?'],
    classic: ['¿Te apetece un clásico?', '¿Quieres uno de los grandes de siempre?'],
    learn: ['¿Quieres aprender algo nuevo?', '¿Te apetece un libro de divulgación?'],
    fantasy: ['¿Te apetece fantasía o ciencia ficción?', '¿Quieres magia, dragones u otros mundos?'],
    mystery: ['¿Te apetece un misterio o un thriller?', '¿Quieres un buen caso que resolver?'],
    romance: ['¿Te apetece una historia de amor?', '¿Quieres algo romántico?'],
    scary: ['¿Te apetece pasar miedo leyendo?', '¿Quieres un libro de terror?'],
    laugh: ['¿Te apetece reírte o vivir una aventura?', '¿Quieres algo divertido y con aventuras?'],
    escape: ['¿Quieres evadirte de la rutina?', '¿Te apetece desconectar del día a día?'],
  },
  games: {
    chill: ['¿Te apetece algo tranquilo para desconectar?', '¿Quieres un juego relajado?'],
    adrenaline: ['¿Buscas adrenalina y acción rápida?', '¿Quieres algo frenético?'],
    challenge: ['¿Te apetece un reto difícil?', '¿Quieres un juego que te haga sudar?'],
    story: ['¿Quieres una buena historia con personajes?', '¿Te importa que tenga buena historia?'],
    friends: ['¿Vas a jugar con amigos?', '¿Es para jugar con más gente?'],
    short: ['¿Tienes poco tiempo para jugar?', '¿Prefieres partidas cortas?'],
    epic: ['¿Quieres perderte horas en un mundo enorme?', '¿Buscas un juego para muchas horas?'],
    fun: ['¿Te apetece algo con humor?', '¿Quieres un juego desenfadado?'],
    dark: ['¿Te apetece algo oscuro o de miedo?', '¿Quieres pasar miedo jugando?'],
    action: ['¿Te apetece acción, tiros o peleas?', '¿Quieres un juego de acción?'],
    rpg: ['¿Te apetece un juego de rol o aventura?', '¿Quieres subir de nivel y explorar?'],
    strategy: ['¿Te apetece pensar y planificar?', '¿Quieres un juego de estrategia?'],
    cozy: ['¿Te apetece un juego casual o de puzles?', '¿Quieres algo sencillito, tipo puzles?'],
    sports: ['¿Te apetecen deportes o carreras?', '¿Quieres un juego de coches o deportes?'],
    retro: ['¿Te apetece algo de plataformas o retro?', '¿Quieres un juego con aire clásico?'],
  },
};

/** Las variantes revisadas de una sonda, o ninguna. */
export const questionsFor = (domainId: string, probeId: string): string[] => QUESTIONS[domainId]?.[probeId] ?? [];
