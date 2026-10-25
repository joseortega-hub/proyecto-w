// Tono de los textos del producto: cercano pero cuidado (como Spotify o Netflix), sin jerga.
// Falla si aparece una palabra vetada en la web, el banco de preguntas o las plantillas.
// El Modo Perreo (homenaje urbano) y los datos de prueba quedan fuera.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { QUESTIONS } from './interview/question-texts.js';

const VETADAS =
  /\b(te pongo|te preparo|te echo|te suelto|te monto|dale|bro|flipar|flipan|flipas|flipa|mola|molan|a tope|en la movie|colegas?|tranquilito|ligerito|sencillito)\b/i;

const WEB = join(import.meta.dirname, '../../web/src');
const API = import.meta.dirname;
const EXCLUIDOS = /(perreo|tone.|reply.ts|artist|tribute|secret-phrases|\.test\.|\.spec\.|\.stories\.|eval[\/])/i;

function ficheros(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return ficheros(path);
    return /\.(ts|tsx)$/.test(name) && !EXCLUIDOS.test(relative(dir, path) + path.slice(-60)) ? [path] : [];
  });
}

/** Líneas con código o textos: sin comentarios completos. */
const sinComentarios = (src: string) => src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));

describe('tono de los textos del producto', () => {
  it('la web y la API no usan palabras vetadas', () => {
    const malas = [...ficheros(WEB), ...ficheros(API)].flatMap((f) =>
      sinComentarios(readFileSync(f, 'utf8')).flatMap((l) => (VETADAS.test(l) ? [`${relative(join(API, '../..'), f)}: ${l.trim().slice(0, 100)}`] : [])),
    );
    expect(malas).toEqual([]);
  });

  it('el banco de preguntas revisado no usa palabras vetadas', () => {
    const malas = Object.values(QUESTIONS).flatMap((p) => Object.values(p).flat().filter((q) => VETADAS.test(q)));
    expect(malas).toEqual([]);
  });
});
