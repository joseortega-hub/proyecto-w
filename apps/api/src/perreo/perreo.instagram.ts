// Piezas puras de la primera pasada de Instagram (el proceso entero está en perreo.instagram.run.ts):
// nombres de usuario de la exportación oficial y consulta SPARQL de Wikidata (P2003 + ocupación de músico).
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
  return `SELECT DISTINCT ?item ?itemLabel ?ig WHERE {
  VALUES ?ig { ${values} }
  ?item wdt:P2003 ?ig .
  { ?item wdt:P106 ?c . } UNION { ?item wdt:P31 ?c . }
  VALUES ?c { wd:Q639669 wd:Q177220 wd:Q2252262 wd:Q183945 wd:Q130857 wd:Q36834 wd:Q488205 wd:Q753110 wd:Q215380 wd:Q2088357 wd:Q10648343 wd:Q5741069 wd:Q18127 wd:Q1762059 wd:Q14350 wd:Q1555508 wd:Q41298 wd:Q1002697 wd:Q4830453 wd:Q3661265 }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}`;
}

