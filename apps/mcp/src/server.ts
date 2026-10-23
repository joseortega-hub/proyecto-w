import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { ApiError, type Answer, type Domain, type SintoniaApi, type TuningEvent } from './api.ts';
import { formatBrowse, formatDomains, formatItem, formatQuestion, formatResult, formatTaste, type Links } from './format.ts';

/** Tope de respuestas automáticas: la API corta antes (máximo de preguntas del dominio). */
const MAX_AUTO_ANSWERS = 12;

const ANSWERS: Record<'si' | 'no' | 'no_lo_se', Answer> = { si: 'yes', no: 'no', no_lo_se: 'unknown' };

const domainArg = z.string().describe('Temática: music, games, movies o books (ver listar_tematicas)');
const preferencesArg = z
  .record(z.string(), z.string())
  .optional()
  .describe('Preferencias previas de la temática, p. ej. {"language":"es"} en música o {"platforms":"nintendo"} en videojuegos. Lo que falte se deduce de la petición.');

type Progress = (progress: number, message: string) => Promise<void>;

export interface ServerOptions extends Links {
  api: SintoniaApi;
}

/**
 * Servidor MCP de Sintonía. Dos formas de pedir una lista:
 * - `crear_lista`: de una vez. La petición es el punto de partida de la entrevista y la API
 *   responde cada pregunta a partir de ella (o "no lo sé" si no lo dice).
 * - `empezar_entrevista` + `responder_pregunta`: Claude hace las preguntas a la persona,
 *   como en la web.
 */
export function createServer({ api, webUrl }: ServerOptions) {
  const links: Links = { webUrl: webUrl.replace(/\/+$/, '') };
  const server = new McpServer(
    { name: 'sintonia', title: 'Sintonía', version: '0.1.0' },
    {
      instructions:
        'Sintonía recomienda música, videojuegos, películas y libros según el ánimo de la persona, con un % de encaje y una explicación por elemento. ' +
        'Para pedir una lista de una vez usa crear_lista; si la persona quiere jugar a la entrevista de sí/no, usa empezar_entrevista y responder_pregunta y hazle las preguntas tal cual, sin responder por ella. ' +
        'Al mostrar una lista, conserva el % de encaje, la explicación y la atribución de la fuente.',
    },
  );
  /** Preferencias de las entrevistas interactivas abiertas, para aplicarlas al terminar. */
  const pendingPreferences = new Map<string, Record<string, string>>();
  let domainsCache: Promise<Domain[]> | null = null;

  const domains = () => {
    domainsCache ??= api.domains().catch((error) => {
      domainsCache = null;
      throw error;
    });
    return domainsCache;
  };
  const domain = async (id: string) => {
    const all = await domains();
    const found = all.find((d) => d.id === id.trim().toLowerCase());
    if (!found) throw new ApiError(404, `No existe la temática "${id}". Disponibles: ${all.map((d) => d.id).join(', ')}.`);
    return found;
  };

  /** Preferencias → Afinando por SSE → resultado formateado. */
  const tune = async (sessionId: string, d: Domain, progress: Progress, options: { preferences?: Record<string, string>; refinements?: string[] } = {}) => {
    if (options.preferences) await api.setPreferences(sessionId, options.preferences);
    for await (const event of api.tune(sessionId, options.refinements)) {
      if (event.step === 'error') throw new ApiError(500, `Afinando ha fallado: ${event.message}`);
      await progress(...tuningProgress(event, d));
    }
    return api.result(sessionId);
  };

  server.registerTool(
    'listar_tematicas',
    {
      title: 'Listar temáticas',
      description: 'Temáticas del catálogo (música, videojuegos, películas, libros) con su tamaño, preferencias previas y ajustes posibles.',
      annotations: { readOnlyHint: true },
    },
    () => run(async () => formatDomains(await domains())),
  );

  server.registerTool(
    'buscar_en_biblioteca',
    {
      title: 'Buscar en la biblioteca',
      description: 'Busca en el catálogo de una temática por texto (título o autor) y/o etiquetas. Devuelve los ids para ver_ficha.',
      inputSchema: {
        tematica: domainArg,
        texto: z.string().max(80).optional().describe('Texto a buscar en el título o el autor'),
        etiquetas: z.array(z.string()).max(20).optional().describe('Etiquetas del catálogo, p. ej. ["rock"] o ["rpg", "open-world"]'),
        limite: z.number().int().min(1).max(30).default(10),
      },
      annotations: { readOnlyHint: true },
    },
    ({ tematica, texto, etiquetas, limite }) =>
      run(async () => {
        const d = await domain(tematica);
        return formatBrowse(d, texto, await api.browse(d.id, { q: texto, tags: etiquetas, limit: limite }), links);
      }),
  );

  server.registerTool(
    'ver_ficha',
    {
      title: 'Ver ficha',
      description: 'Ficha de un elemento del catálogo (por id): autor, etiquetas, carácter, descripción, enlaces y elementos parecidos por embedding.',
      inputSchema: { id: z.uuid().describe('Id del elemento (sale en las búsquedas y en las listas)') },
      annotations: { readOnlyHint: true },
    },
    ({ id }) =>
      run(async () => {
        const item = await api.item(id);
        const [d, similar] = await Promise.all([domain(item.domainId), api.similar(id, 5).catch(() => [])]);
        return formatItem(item, d, similar, links);
      }),
  );

  server.registerTool(
    'crear_lista',
    {
      title: 'Crear una lista',
      description:
        'Crea una lista personalizada a partir de una petición en lenguaje natural ("hazme una lista para el gimnasio"). ' +
        'La petición es el punto de partida de la entrevista de Sintonía: lo que deja claro no se pregunta y el resto de preguntas se responden a partir de ella (o "no lo sé"). ' +
        'Devuelve cada elemento con su % de encaje y la explicación de por qué se eligió. Tarda entre 10 y 40 segundos.',
      inputSchema: {
        tematica: domainArg,
        peticion: z.string().trim().min(3).max(500).describe('Lo que pide la persona, con sus palabras'),
        preferencias: preferencesArg,
      },
    },
    ({ tematica, peticion, preferencias }, extra) =>
      run(async () => {
        const progress = progressReporter(extra);
        const d = await domain(tematica);
        let view = await api.startSession(d.id, peticion);
        const transcript: { question: string; answer: Answer }[] = [];
        while (view.status === 'asking' && view.question && transcript.length < MAX_AUTO_ANSWERS) {
          await progress(transcript.length, `Respondiendo: ${view.question.text}`);
          const auto = await api.autoAnswer(view.id);
          transcript.push({ question: auto.question, answer: auto.answer });
          view = auto.session;
        }
        if (view.status === 'asking') throw new ApiError(500, 'La entrevista no ha terminado tras las respuestas automáticas');
        const result = await tune(view.id, d, progress, { preferences: preferencias ?? {} });
        return formatResult(result, d, links, transcript);
      }),
  );

  server.registerTool(
    'empezar_entrevista',
    {
      title: 'Empezar la entrevista',
      description:
        'Empieza la entrevista adaptativa de sí/no (estilo Akinator) y devuelve la primera pregunta. ' +
        'Haz cada pregunta a la persona tal cual y pasa su respuesta a responder_pregunta; no respondas por ella. ' +
        'Opcional: un punto de partida en texto ("estoy cansado, algo tranquilo"), que ahorra preguntas.',
      inputSchema: {
        tematica: domainArg,
        punto_de_partida: z.string().trim().max(500).optional().describe('Cómo está o qué le apetece, con sus palabras'),
        preferencias: preferencesArg,
      },
    },
    ({ tematica, punto_de_partida, preferencias }) =>
      run(async () => {
        const d = await domain(tematica);
        const view = await api.startSession(d.id, punto_de_partida || undefined);
        pendingPreferences.set(view.id, preferencias ?? {});
        return formatQuestion(view, d);
      }),
  );

  server.registerTool(
    'responder_pregunta',
    {
      title: 'Responder la pregunta',
      description:
        'Responde la pregunta pendiente de una entrevista con la respuesta de la persona. Devuelve la siguiente pregunta o, cuando ya hay suficiente, la lista con el % de encaje y las explicaciones.',
      inputSchema: {
        entrevista: z.uuid().describe('Id de la entrevista (lo devuelve empezar_entrevista)'),
        respuesta: z.enum(['si', 'no', 'no_lo_se']),
      },
    },
    ({ entrevista, respuesta }, extra) =>
      run(async () => {
        const current = await api.session(entrevista);
        const d = await domain(current.domainId);
        if (current.status !== 'asking' || !current.question) throw new ApiError(409, 'Esta entrevista ya no tiene preguntas pendientes');
        const view = await api.answer(entrevista, ANSWERS[respuesta], current.step);
        if (view.status === 'asking') return formatQuestion(view, d);
        const preferences = pendingPreferences.get(entrevista) ?? {};
        pendingPreferences.delete(entrevista);
        return formatResult(await tune(entrevista, d, progressReporter(extra), { preferences }), d, links);
      }),
  );

  server.registerTool(
    'ajustar_lista',
    {
      title: 'Ajustar una lista',
      description: 'Relanza la búsqueda de una lista ya creada con ajustes rápidos (p. ej. more-energy, more-calm), sin repetir la entrevista.',
      inputSchema: {
        entrevista: z.uuid().describe('Id de la lista (sale en su enlace /resultado/<id>)'),
        ajustes: z.array(z.string()).min(1).max(4).describe('Claves de ajuste de la temática (ver listar_tematicas)'),
      },
    },
    ({ entrevista, ajustes }, extra) =>
      run(async () => {
        const d = await domain((await api.session(entrevista)).domainId);
        const valid = new Set(d.refinements.map((r) => r.key));
        const unknown = ajustes.filter((a) => !valid.has(a));
        if (unknown.length) throw new ApiError(400, `Ajustes desconocidos: ${unknown.join(', ')}. Disponibles: ${[...valid].join(', ')}.`);
        return formatResult(await tune(entrevista, d, progressReporter(extra), { refinements: ajustes }), d, links);
      }),
  );

  server.registerTool(
    'ver_mis_gustos',
    {
      title: 'Ver mis gustos',
      description: 'Gustos de largo plazo guardados para esta temática (lo que gusta, lo que no y lo aprendido de los 👍/👎). Suben la puntuación de lo que encaja en las listas.',
      inputSchema: { tematica: domainArg },
      annotations: { readOnlyHint: true },
    },
    ({ tematica }) =>
      run(async () => {
        const d = await domain(tematica);
        return formatTaste(await api.taste(d.id), d);
      }),
  );

  server.registerTool(
    'editar_mis_gustos',
    {
      title: 'Editar mis gustos',
      description:
        'Añade o quita gustos de una temática. Acepta identificadores del vocabulario (ver_mis_gustos) o un texto libre ("me encantan Pokémon y los juegos de mundo abierto, odio el terror") que se traduce a etiquetas del catálogo.',
      inputSchema: {
        tematica: domainArg,
        texto: z.string().trim().max(500).optional().describe('Gustos contados con palabras'),
        me_gusta: z.array(z.string()).max(20).optional().describe('Identificadores que añadir a "me gusta"'),
        no_me_gusta: z.array(z.string()).max(20).optional().describe('Identificadores que añadir a "no me gusta"'),
        quitar: z.array(z.string()).max(40).optional().describe('Identificadores que quitar de las dos listas'),
      },
    },
    ({ tematica, texto, me_gusta = [], no_me_gusta = [], quitar = [] }) =>
      run(async () => {
        const d = await domain(tematica);
        const [current, interpreted] = await Promise.all([api.taste(d.id), texto ? api.interpretTaste(d.id, texto) : null]);
        const removed = new Set(quitar);
        const added = { likes: [...me_gusta, ...(interpreted?.likes.map((l) => l.id) ?? [])], dislikes: [...no_me_gusta, ...(interpreted?.dislikes.map((l) => l.id) ?? [])] };
        // Lo nuevo manda: si algo pasa de una lista a la otra, sale de la anterior.
        const likes = [...current.likes.map((l) => l.id).filter((id) => !added.dislikes.includes(id)), ...added.likes].filter((id) => !removed.has(id));
        const dislikes = [...current.dislikes.map((l) => l.id).filter((id) => !added.likes.includes(id)), ...added.dislikes].filter((id) => !removed.has(id));
        const saved = await api.saveTaste(d.id, { likes: unique(likes), dislikes: unique(dislikes) });
        const ignored = [...added.likes, ...added.dislikes].filter((id) => !saved.likes.some((l) => l.id === id) && !saved.dislikes.some((l) => l.id === id) && !removed.has(id));
        return formatTaste(saved, d) + (ignored.length ? `\n\nNo están en el vocabulario y se han ignorado: ${unique(ignored).join(', ')}.` : '');
      }),
  );

  server.registerTool(
    'valorar_elemento',
    {
      title: 'Valorar un elemento',
      description: '👍 o 👎 a un elemento de una lista: ajusta el peso de sus etiquetas en los gustos de la temática. "quitar" deshace la valoración.',
      inputSchema: { id: z.uuid().describe('Id del elemento'), valoracion: z.enum(['me_gusta', 'no_me_gusta', 'quitar']) },
    },
    ({ id, valoracion }) =>
      run(async () => {
        const item = await api.item(id);
        const value = valoracion === 'me_gusta' ? 'up' : valoracion === 'no_me_gusta' ? 'down' : null;
        await api.feedback(item.domainId, id, value);
        return value ? `Anotado ${value === 'up' ? '👍' : '👎'} para «${item.title}».` : `Quitada la valoración de «${item.title}».`;
      }),
  );

  server.registerPrompt(
    'lista_para',
    {
      title: 'Lista para un momento',
      description: 'Pide a Sintonía una lista para un momento concreto',
      argsSchema: { momento: z.string().describe('Para qué es la lista, p. ej. "el gimnasio"'), tematica: z.string().optional().describe('music, games, movies o books') },
    },
    ({ momento, tematica }) => ({
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: `Hazme una lista de ${tematica ?? 'music'} en Sintonía para ${momento}. Enséñame el % de encaje y por qué ha elegido cada una.` },
        },
      ],
    }),
  );

  return server;
}

/** Ejecuta una herramienta y convierte los errores en un resultado legible para el modelo. */
async function run(fn: () => Promise<string>): Promise<CallToolResult> {
  try {
    return { content: [{ type: 'text', text: await fn() }] };
  } catch (error) {
    const message = error instanceof ApiError || error instanceof Error ? error.message : String(error);
    return { isError: true, content: [{ type: 'text', text: message }] };
  }
}

/** Avisos de progreso MCP (si el cliente los pide): además, evitan que salte el tiempo máximo. */
function progressReporter(extra: { _meta?: { progressToken?: string | number }; sendNotification: (n: never) => Promise<void> }): Progress {
  const token = extra._meta?.progressToken;
  let last = 0;
  return async (progress, message) => {
    if (token === undefined) return;
    last = Math.max(last + 1, progress);
    await extra
      .sendNotification({ method: 'notifications/progress', params: { progressToken: token, progress: last, message } } as never)
      .catch(() => undefined);
  };
}

export function tuningProgress(event: TuningEvent, d: Domain): [number, string] {
  switch (event.step) {
    case 'profile':
      return [20, 'Perfil de ánimo calculado'];
    case 'candidates':
      return [30, `${event.count} candidatos de ${event.total} ${d.itemNounPlural}`];
    case 'fit':
      return [30 + Math.round((event.checked / Math.max(1, event.total)) * 40), `Encaje comprobado en ${event.checked} de ${event.total}`];
    case 'explain':
      return [80, 'Escribiendo las explicaciones'];
    case 'done':
      return [100, 'Lista lista'];
    case 'error':
      return [100, event.message];
  }
}

const unique = <T>(values: T[]) => [...new Set(values)];
