import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { readSse, SintoniaApi, type Domain } from './api.ts';
import { createServer } from './server.ts';
import { decodeEntities } from './format.ts';

const music: Domain = {
  id: 'music',
  name: 'Música',
  itemNoun: 'canción',
  itemNounPlural: 'canciones',
  itemCount: 803,
  gender: 'f',
  verb: 'escuchar',
  creatorLabel: 'artista',
  playable: true,
  source: { name: 'Jamendo', url: 'https://www.jamendo.com', attribution: 'Música con licencias Creative Commons de Jamendo.' },
  tagGroups: [],
  refinements: [{ key: 'more-energy', label: '+ energía' }],
  preferences: [{ key: 'language', label: 'Idioma de la letra', options: [{ value: 'es', label: 'Español' }], anyValue: 'any' }],
};

const SESSION = '11111111-1111-4111-8111-111111111111';
const ITEM = '22222222-2222-4222-8222-222222222222';
const item = { id: ITEM, domainId: 'music', title: 'Run Fast', subtitle: 'Banda X', description: null, imageUrl: null, mediaUrl: null, externalUrl: 'https://jamendo.com/track/1', durationSec: 185, attributes: { energy: 0.9 }, tags: ['rock'], facets: {} };
const view = (step: number, question: string | null) => ({
  id: SESSION,
  domainId: 'music',
  status: question ? 'asking' : 'ready',
  step,
  minQuestions: 3,
  maxQuestions: 8,
  confidence: 0.5,
  chips: [],
  question: question ? { text: question, reason: '' } : null,
  fromText: ['con energía'],
  taste: [],
  context: {},
});

/** API falsa: entrevista de dos preguntas que se responden solas y Afinando por SSE. */
function fakeApi() {
  const calls: { method: string; path: string; body: unknown; user: string | null }[] = [];
  let answered = 0;
  const fetch = (async (url: string, init: RequestInit) => {
    const path = url.replace('http://api.test/api', '');
    const method = init.method ?? 'GET';
    calls.push({ method, path, body: init.body ? JSON.parse(String(init.body)) : undefined, user: new Headers(init.headers).get('x-sintonia-user') });
    const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
    if (path === '/domains') return json([music]);
    if (method === 'POST' && path === '/sessions') return json(view(1, '¿Te apetece sudar?'));
    if (path === `/sessions/${SESSION}/auto-answer`) {
      answered++;
      const question = answered === 1 ? '¿Te apetece sudar?' : '¿Algo con voz?';
      return json({ question, answer: answered === 1 ? 'yes' : 'unknown', confidence: 0.9, session: view(answered + 1, answered === 1 ? '¿Algo con voz?' : null) });
    }
    if (path === `/sessions/${SESSION}/preferences`) return json({});
    if (path.startsWith(`/sessions/${SESSION}/tune`)) {
      const events = ['{"step":"profile"}', '{"step":"fit","checked":8,"total":16}', `{"step":"done","sessionId":"${SESSION}"}`];
      return new Response(events.map((e) => `data: ${e}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } });
    }
    if (path === `/sessions/${SESSION}/result`) {
      return json({
        id: SESSION,
        domainId: 'music',
        title: 'Gimnasio a tope',
        answeredCount: 2,
        chips: ['con energía'],
        notice: null,
        candidates: 40,
        catalogSize: 803,
        appliedRefinements: [],
        refinements: music.refinements,
        preferences: null,
        entries: [{ match: 94, fit: 0.91, reason: 'Guitarras rápidas para no parar.', likes: [], item }],
      });
    }
    if (path === `/items/${ITEM}`) return json(item);
    if (path === '/items/missing') return new Response(JSON.stringify({ message: 'Elemento no encontrado' }), { status: 404 });
    return new Response('{}', { status: 404 });
  }) as typeof globalThis.fetch;
  return { api: new SintoniaApi({ baseUrl: 'http://api.test/api', userId: 'mcp-user', timeZone: 'Europe/Madrid', fetch }), calls };
}

async function connect() {
  const { api, calls } = fakeApi();
  const server = createServer({ api, webUrl: 'http://web.test/' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args });
    return { text: (result.content as { text: string }[])[0].text, isError: !!result.isError };
  };
  return { client, call, calls };
}

describe('servidor MCP', () => {
  it('expone las herramientas de catálogo, listas y gustos', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(['listar_tematicas', 'buscar_en_biblioteca', 'ver_ficha', 'crear_lista', 'empezar_entrevista', 'responder_pregunta', 'ver_mis_gustos', 'editar_mis_gustos']),
    );
  });

  it('crear_lista responde la entrevista sola y devuelve el % de encaje y la explicación', async () => {
    const { call, calls } = await connect();
    const { text, isError } = await call('crear_lista', { tematica: 'music', peticion: 'hazme una lista para el gimnasio', preferencias: { language: 'es' } });
    expect(isError).toBe(false);
    expect(text).toContain('Gimnasio a tope');
    expect(text).toContain('94 % de encaje');
    expect(text).toContain('Guitarras rápidas para no parar.');
    expect(text).toContain('¿Te apetece sudar? → sí');
    expect(text).toContain('¿Algo con voz? → no lo sé');
    expect(text).toContain('http://web.test/music/resultado/');
    expect(text).toContain('Creative Commons');

    const start = calls.find((c) => c.method === 'POST' && c.path === '/sessions');
    expect(start?.body).toMatchObject({ domainId: 'music', initialText: 'hazme una lista para el gimnasio', client: { timeZone: 'Europe/Madrid' } });
    expect(start?.user).toBe('mcp-user');
    expect(calls.filter((c) => c.path.endsWith('/auto-answer'))).toHaveLength(2);
    expect(calls.find((c) => c.path.endsWith('/preferences'))?.body).toEqual({ preferences: { language: 'es' } });
  });

  it('devuelve un error legible si la temática no existe', async () => {
    const { call } = await connect();
    const { text, isError } = await call('crear_lista', { tematica: 'podcasts', peticion: 'algo para correr' });
    expect(isError).toBe(true);
    expect(text).toContain('No existe la temática "podcasts"');
    expect(text).toContain('music');
  });

  it('ver_ficha enseña el elemento con su enlace y la atribución', async () => {
    const { call } = await connect();
    const { text } = await call('ver_ficha', { id: ITEM });
    expect(text).toContain('## Run Fast');
    expect(text).toContain('Artista: Banda X');
    expect(text).toContain('http://web.test/music/biblioteca/');
    expect(text).toContain('Jamendo');
  });
});

describe('readSse', () => {
  it('separa los eventos aunque lleguen partidos entre trozos', async () => {
    const chunks = ['data: {"a":', '1}\n\nda', 'ta: {"b":2}\r\n\r\n: comentario\n\ndata: {"c":3}'];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(new TextEncoder().encode(c));
        controller.close();
      },
    });
    const events: string[] = [];
    for await (const e of readSse(body)) events.push(e);
    expect(events).toEqual(['{"a":1}', '{"b":2}', '{"c":3}']);
  });
});

describe('decodeEntities', () => {
  it('limpia las entidades HTML de los nombres', () => {
    expect(decodeEntities('Axl &amp; Arth &quot;live&quot; &#39;23')).toBe(`Axl & Arth "live" '23`);
  });
});
