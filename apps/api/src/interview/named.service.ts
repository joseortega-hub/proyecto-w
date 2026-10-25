import { Injectable, Logger } from '@nestjs/common';
import { anchorTag } from '../catalog/catalog-adapter.js';
import type { DomainRow } from '../domains/domains.service.js';
import { ItemsService } from '../items/items.service.js';
import { AnchorsService } from './anchors.service.js';
import { entityIndex } from './catalog-match.js';
import type { Anchor, AnchorCondition } from './interview.types.js';
import { detectMentions, resolveName, type NamedRole } from './named.js';
import { normalize } from './interview.engine.js';

/** Temáticas con fuente en directo donde se piden nombres propios. */
const NAMED_DOMAINS = new Set(['books', 'movies', 'games']);
/** Cuánto espera a la fuente al buscar lo que el catálogo no tiene del nombre pedido. */
const NAMED_WAIT_MS = 20_000;

const KINDS: Record<NamedRole, Anchor['kind'][]> = {
  person: ['creator'],
  company: ['studio'],
  saga: ['franchise', 'studio'],
  any: ['creator', 'studio', 'franchise'],
};

export interface NamedResult {
  /** Filtros duros: toda la lista es de este nombre. */
  anchors: Anchor[];
  /** El texto sin las menciones, para lo que sí entiende la IA (ánimo, parecidos). */
  rest: string;
}

/**
 * Nombres propios pedidos de forma explícita ("libros de la autora saran j maas"): se detectan
 * con patrones, se resuelven con tolerancia a erratas contra el catálogo y, si falta, contra la
 * fuente en directo, y quedan como FILTRO DURO. Todo antes de la IA y sin depender de ella.
 */
@Injectable()
export class NamedService {
  private readonly logger = new Logger('Nombres');

  constructor(
    private readonly anchors: AnchorsService,
    private readonly items: ItemsService,
  ) {}

  async resolve(domain: DomainRow, text: string, userId: string | null): Promise<NamedResult> {
    if (!NAMED_DOMAINS.has(domain.id)) return { anchors: [], rest: text };
    const mentions = detectMentions(text, domain.id);
    if (!mentions.length) return { anchors: [], rest: text };
    const { config } = domain;
    const options = { titleFamilies: !config.playable };
    const out: Anchor[] = [];
    let rest = text;
    for (const mention of mentions) {
      let catalog = await this.items.catalog(domain.id, [], userId);
      let found = resolveName(mention, catalog, config, entityIndex(catalog, config, options));
      let target = found?.name ?? mention.name;
      let searched = false;
      let pending = false;
      // Poco o nada en el catálogo: se averigua el nombre real en la fuente y se trae lo suyo.
      if (!found || found.count < config.result.size) {
        const real = await this.anchors.canonicalName(domain, mention.name, KINDS[mention.role]);
        // Un nombre real más corto que lo escrito y que es su comienzo ("Zeld" para «zelda») es un hallazgo casual, no una corrección.
        const acceptable = real && !(normalize(mention.name).startsWith(normalize(real.name)) && real.name.length < mention.name.length);
        target = acceptable ? real.name : target;
        const kind = (acceptable ? real?.kind : undefined) ?? found?.kind ?? (mention.role === 'person' || mention.role === 'any' ? 'creator' : mention.role === 'company' ? 'studio' : 'franchise');
        // Sin saber de qué tipo es (autor, estudio, saga), se prueba como persona y como saga.
        const tries: Anchor['kind'][] = acceptable || found || mention.role === 'person' || mention.role === 'company' ? [kind] : [kind, 'franchise'];
        for (const k of [...new Set(tries)]) {
          const wait = new Promise<number>((resolve) => setTimeout(() => resolve(-1), NAMED_WAIT_MS));
          const brought = await Promise.race([this.anchors.ensureCoverage(domain, [{ label: target, kind: k, terms: [target], required: true }], userId), wait]);
          searched = brought !== 0;
          catalog = await this.items.catalog(domain.id, [], userId);
          found = resolveName({ name: target, role: mention.role }, catalog, config, entityIndex(catalog, config, options)) ?? found;
          if (found) break;
          // La fuente aún está trayendo lo suyo (tarda): el filtro ya vale por nombre y etiqueta, y el inicio espera al resto.
          if (brought === -1) {
            const person = k === 'creator';
            out.push({
              label: target,
              kind: k,
              terms: [target],
              required: true,
              named: true,
              match: [{ field: person ? 'creator' : 'title', values: [target] }, { field: 'tags', values: [anchorTag({ label: target } as Anchor)] }],
              ...(normalize(target) !== normalize(mention.name) ? { said: mention.name } : {}),
            });
            rest = mention.rest;
            this.logger.log(`«${mention.name}» → ${target} (${k}): la fuente tarda, filtro por nombre y etiqueta`);
            pending = true;
            break;
          }
        }
        if (pending) continue;
      }
      if (!found) {
        this.logger.log(`«${mention.name}» (${mention.role}): sin coincidencia`);
        continue;
      }
      const conditions: AnchorCondition[] = [...found.conditions];
      if (searched) conditions.push({ field: 'tags', values: [anchorTag({ label: found.name } as Anchor)] });
      out.push({
        label: found.name,
        kind: found.kind,
        terms: [found.name],
        required: true,
        match: conditions,
        named: true,
        ...(normalize(found.name) !== normalize(mention.name) ? { said: mention.name } : {}),
      });
      rest = mention.rest;
      this.logger.log(`«${mention.name}» → ${found.name} (${found.kind}, ${found.count} en el catálogo, parecido ${found.similarity.toFixed(2)})`);
    }
    return { anchors: out, rest: out.length ? rest : text };
  }
}
