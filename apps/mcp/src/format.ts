import type { Answer, Domain, Item, SessionResult, SessionView, Taste } from './api.ts';

/** Textos en Markdown para Claude: breves, con enlaces y con la atribución de cada fuente. */

const ANSWER_TEXT: Record<Answer, string> = { yes: 'sí', no: 'no', unknown: 'no lo sé' };

export interface Links {
  /** Raíz de la web de Sintonía (p. ej. `http://localhost:5173`). */
  webUrl: string;
}

export function formatDomains(domains: Domain[]) {
  return [
    '## Temáticas de Sintonía',
    ...domains.map(
      (d) =>
        `- **${d.name}** (\`${d.id}\`): ${d.itemCount} ${d.itemNounPlural}, de ${d.source.name}.` +
        (d.preferences.length
          ? ` Preferencias: ${d.preferences.map((p) => `${p.label.toLowerCase()} \`${p.key}\` (${p.options.map((o) => `\`${o.value}\``).join(', ')})`).join('; ')}.`
          : '') +
        (d.refinements.length ? ` Ajustes: ${d.refinements.map((r) => `\`${r.key}\``).join(', ')}.` : ''),
    ),
  ].join('\n');
}

export function formatBrowse(domain: Domain, query: string | undefined, page: { total: number; items: Item[] }, links: Links) {
  if (!page.items.length) return `Sin resultados en ${domain.name}${query ? ` para «${query}»` : ''}.`;
  return [
    `## ${domain.name}: ${page.total} ${domain.itemNounPlural}${query ? ` para «${query}»` : ''}`,
    ...page.items.map((item) => `- ${itemLine(item, domain, links)} · id \`${item.id}\``),
    page.total > page.items.length ? `\nMostrando ${page.items.length} de ${page.total}.` : '',
    attribution(domain),
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatItem(item: Item, domain: Domain, similar: Item[], links: Links) {
  const scales = Object.entries(item.attributes)
    .map(([key, value]) => `${key} ${Math.round(value * 100)} %`)
    .join(', ');
  return [
    `## ${decodeEntities(item.title)}`,
    item.subtitle ? `${capitalize(domain.creatorLabel)}: ${decodeEntities(item.subtitle)}` : null,
    item.durationSec ? `Duración: ${duration(item.durationSec)}` : null,
    item.tags.length ? `Etiquetas: ${item.tags.slice(0, 12).join(', ')}` : null,
    scales ? `Carácter: ${scales}` : null,
    item.description ? `\n${item.description.slice(0, 600)}${item.description.length > 600 ? '…' : ''}` : null,
    '',
    `Ficha en Sintonía: ${itemUrl(item, links)}`,
    item.externalUrl ? `En ${domain.source.name}: ${item.externalUrl}` : null,
    item.mediaUrl && domain.playable ? `Audio: ${item.mediaUrl}` : null,
    similar.length ? `\n**Parecidos**\n${similar.map((s) => `- ${itemLine(s, domain, links)} · id \`${s.id}\``).join('\n')}` : null,
    attribution(domain),
  ]
    .filter((l) => l !== null)
    .join('\n');
}

export function formatQuestion(view: SessionView, domain: Domain) {
  const lines = [`Entrevista \`${view.id}\` (${domain.name}), pregunta ${view.step} de ${view.minQuestions}-${view.maxQuestions}.`];
  if (view.step === 1) lines.push(...contextLines(view));
  if (view.question) {
    lines.push('', `**${view.question.text}**`);
    if (view.question.reason) lines.push(`_${view.question.reason}_`);
    lines.push('', 'Responde con `responder_pregunta` (si, no o no_lo_se).');
  }
  return lines.join('\n');
}

export function formatResult(
  result: SessionResult,
  domain: Domain,
  links: Links,
  transcript: { question: string; answer: Answer }[] = [],
) {
  const noun = result.entries.length === 1 ? domain.itemNoun : domain.itemNounPlural;
  const lines = [
    `## ${result.title}`,
    `${result.entries.length} ${noun} de ${result.catalogSize} en ${domain.name} (${result.candidates} candidatos evaluados).`,
  ];
  if (result.chips.length) lines.push(`Perfil: ${result.chips.join(', ')}.`);
  if (transcript.length) {
    lines.push('', '**Entrevista respondida a partir de la petición**');
    lines.push(...transcript.map((t) => `- ${t.question} → ${ANSWER_TEXT[t.answer]}`));
  }
  if (result.notice) lines.push('', `> ${result.notice}`);
  lines.push('');
  result.entries.forEach((e, i) => {
    lines.push(`${i + 1}. ${itemLine(e.item, domain, links)} · **${e.match} % de encaje**`);
    lines.push(`   ${e.reason}${e.likes.length ? ` (Va con tus gustos: ${e.likes.join(', ')}.)` : ''}`);
  });
  lines.push('', `Lista completa en Sintonía: ${links.webUrl}/${result.domainId}/resultado/${result.id}`);
  if (result.refinements.length) {
    lines.push(`Ajustes posibles con \`ajustar_lista\`: ${result.refinements.map((r) => `\`${r.key}\` (${r.label})`).join(', ')}.`);
  }
  lines.push(attribution(domain));
  return lines.join('\n');
}

export function formatTaste(taste: Taste, domain: Domain) {
  const list = (items: { label: string }[]) => (items.length ? items.map((i) => i.label).join(', ') : '—');
  const lines = [
    `## Mis gustos en ${domain.name}`,
    `Me gusta: ${list(taste.likes)}`,
    `No me gusta: ${list(taste.dislikes)}`,
  ];
  if (taste.learned.length) {
    lines.push(`Aprendido de los 👍/👎: ${taste.learned.map((l) => `${l.label} ${l.weight > 0 ? '+' : ''}${l.weight.toFixed(2)}`).join(', ')}`);
  }
  const prefs = Object.entries(taste.preferences);
  if (prefs.length) lines.push(`Preferencias habituales: ${prefs.map(([k, v]) => `${k}=${v}`).join(', ')}`);
  lines.push(
    '',
    `Identificadores válidos (grupos con @ y etiquetas): ${[...taste.vocabulary.groups, ...taste.vocabulary.tags.slice(0, 60)]
      .map((v) => `\`${v.id}\``)
      .join(', ')}`,
  );
  return lines.join('\n');
}

function contextLines(view: SessionView) {
  const { context } = view;
  const when = [context.diaSemana, context.franja].filter(Boolean).join(' ');
  const weather = context.tiempo?.descripcion
    ? `${context.tiempo.temperaturaC !== undefined ? `${Math.round(context.tiempo.temperaturaC)} °C, ` : ''}${context.tiempo.descripcion}`
    : '';
  const lines: string[] = [];
  if (when || weather) lines.push(`Contexto: ${[when, weather].filter(Boolean).join(' · ')}.`);
  if (view.fromText.length) lines.push(`Por lo que ha contado: ${view.fromText.join(', ')}.`);
  if (view.taste.length) lines.push(`Teniendo en cuenta sus gustos: ${view.taste.join(', ')}.`);
  return lines;
}

function itemLine(item: Item, domain: Domain, links: Links) {
  const by = item.subtitle ? ` — ${decodeEntities(item.subtitle)}` : '';
  return `[${decodeEntities(item.title).replace(/[[\]]/g, '')}](${item.externalUrl ?? itemUrl(item, links)})${by}${domain.playable && item.durationSec ? ` (${duration(item.durationSec)})` : ''}`;
}

/** Algunas fuentes (Jamendo) traen entidades HTML en los nombres: "Axl &amp; Arth". */
export const decodeEntities = (s: string) =>
  s.replace(/&(amp|quot|#39|apos|lt|gt);/g, (_, e: string) => ({ amp: '&', quot: '"', '#39': "'", apos: "'", lt: '<', gt: '>' })[e] ?? _);
const itemUrl = (item: Item, links: Links) => `${links.webUrl}/${item.domainId}/biblioteca/${item.id}`;
const attribution = (domain: Domain) => `\n_${domain.source.attribution} Fuente: ${domain.source.url}_`;
const duration = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
