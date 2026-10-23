import { gamesDomain } from '../domains/games.domain.js';
import { collectContext, contextKey, dayPart, describeWeather, stateExtras, timeContext } from './interview.context.js';

const defaults = { timeZone: 'Europe/Madrid', latitude: 40.4168, longitude: -3.7038 };
const meteo = (current: object) =>
  (async () => new Response(JSON.stringify({ current }), { status: 200 })) as unknown as typeof fetch;

describe('contexto automático', () => {
  // Viernes 23/10/2026 a las 19:05 UTC = 21:05 en Madrid (horario de verano).
  const friday = new Date('2026-10-23T19:05:00Z');

  it('hora, franja y día en la zona horaria de la persona', () => {
    expect(timeContext(friday, 'Europe/Madrid')).toEqual({ hora: '21:05', franja: 'noche', diaSemana: 'viernes', finDeSemana: true });
    expect(timeContext(friday, 'America/Mexico_City')).toMatchObject({ hora: '13:05', franja: 'mediodía', finDeSemana: false });
    expect([5, 9, 13, 18, 23].map(dayPart)).toEqual(['madrugada', 'mañana', 'mediodía', 'tarde', 'noche']);
  });

  it('el tiempo de Open-Meteo en palabras', async () => {
    expect([0, 3, 61, 95].map(describeWeather)).toEqual(['despejado', 'nublado', 'lluvia', 'tormenta']);
    const context = await collectContext(
      { timeZone: 'Europe/Madrid', latitude: 41.39, longitude: 2.17 },
      defaults,
      friday,
      meteo({ temperature_2m: 14.6, weather_code: 63, is_day: 0 }),
    );
    expect(context.tiempo).toEqual({ descripcion: 'lluvia', temperaturaC: 15, esDeDia: false });
  });

  it('sin Open-Meteo (o con una zona horaria rara) sigue con lo que tiene', async () => {
    const down = (async () => new Response('', { status: 503 })) as unknown as typeof fetch;
    const context = await collectContext({ timeZone: 'Marte/Olympus', latitude: 10, longitude: 10 }, defaults, friday, down);
    expect(context.tiempo).toBeUndefined();
    expect(context.hora).toBe('21:05');
  });

  it('todo va en el state como dato, y la clave de caché ignora los minutos', () => {
    const context = timeContext(friday, 'Europe/Madrid');
    const taste = { likes: ['@rpg'], dislikes: [], learned: {} };
    const extras = stateExtras({ context, initialText: null, taste }, gamesDomain.config);
    expect(extras).toEqual({ contexto: context, gustosDeLaPersona: expect.objectContaining({ leGusta: ['rol y aventura'] }) });
    expect(contextKey(context)).toBe(contextKey({ ...context, hora: '21:40' }));
  });
});
