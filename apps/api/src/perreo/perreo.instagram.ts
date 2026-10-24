// Artistas entre tus seguidos de Instagram: pnpm perreo:instagram
// Lee tu exportación oficial (data/privado/following.json, ignorada por Git), busca en Wikidata qué usuarios
// son de músicos (propiedad P2003 = usuario de Instagram y ocupación de músico) y guarda SOLO esos en
// data/privado/perreo/instagram.json. El resto de cuentas se descarta y nada sale de tu máquina salvo
// los nombres de usuario que se consultan a Wikidata (una consulta pública).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../');
const input = join(root, 'data', 'privado', 'following.json');
const output = join(root, 'data', 'privado', 'perreo', 'instagram.json');

interface Following {
  relationships_following?: { title?: string; string_list_data?: { href?: string; value?: string }[] }[];
}

/** Nombres de usuario de la exportación oficial (`title`, o el final del enlace `instagram.com/_u/usuario`). */
export function usernames(data: Following | { title?: string; string_list_data?: { href?: string; value?: string }[] }[]): string[] {
  const list = Array.isArray(data) ? data : (data.relationships_following ?? []);
  const names = list.flatMap((entry) => {
    const first = entry.string_list_data?.[0];
    const fromLink = /instagram\.com\/(?:_u\/)?([\w.]+)/.exec(first?.href ?? '')?.[1];
    return [entry.title || first?.value || fromLink].filter((n): n is string => !!n && /^[\w.]{1,30}$/.test(n));
  });
  return [...new Set(names)];
}

/** Consulta SPARQL: elementos con ese usuario de Instagram que sean músicos, cantantes, raperos, DJ o productores. */
export function sparql(users: string[]): string {
  const values = users.map((u) => `"${u}"`).join(' ');
  return `SELECT ?item ?itemLabel ?ig WHERE {
  VALUES ?ig { ${values} }
  ?item wdt:P2003 ?ig .
  ?item wdt:P106 ?occupation .
  VALUES ?occupation { wd:Q639669 wd:Q177220 wd:Q2252262 wd:Q183945 wd:Q130857 wd:Q36834 wd:Q488205 wd:Q753110 }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const users = usernames(JSON.parse(readFileSync(input, 'utf8')) as Following);
  console.log(`Seguidos: ${users.length} cuentas (no se guarda ninguna que no sea de un artista)`);
  const found = new Map<string, { name: string; instagram: string; wikidata: string }>();
  for (let i = 0; i < users.length; i += 150) {
    const res = await fetch('https://query.wikidata.org/sparql', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/sparql-results+json', 'user-agent': 'Sintonia/0.1 (easter egg educativo)' },
      body: new URLSearchParams({ query: sparql(users.slice(i, i + 150)) }),
    });
    if (!res.ok) throw new Error(`Wikidata respondió ${res.status}`);
    const body = (await res.json()) as { results: { bindings: { item: { value: string }; itemLabel: { value: string }; ig: { value: string } }[] } };
    for (const b of body.results.bindings) found.set(b.ig.value.toLowerCase(), { name: b.itemLabel.value, instagram: b.ig.value, wikidata: b.item.value.split('/').pop()! });
  }
  writeFileSync(output, JSON.stringify([...found.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')), null, 1));
  console.log(`Artistas entre tus seguidos: ${found.size} → ${output}`);
}
