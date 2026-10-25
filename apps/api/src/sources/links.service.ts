import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { politeFetcher } from '../catalog/derive.js';
import { config } from '../config.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { interviewSessions } from '../db/schema.js';
import type { Anchor } from '../interview/interview.types.js';
import { candidateLinks, type EntityLinks, MAX_LINKS, norm, pickEntity, summarize, verifyUrl, type WikidataEntity } from './links.js';
import { SourcesService } from './sources.service.js';

/**
 * "Para saber más": enlaces reales sobre una franquicia, saga, autor, estudio o artista. La entidad
 * se busca en Wikidata, los enlaces salen de sus propiedades (web oficial, Fandom, Wikipedia, ficha
 * en el catálogo, subreddit y redes) y solo se devuelven los que responden. El resultado se guarda
 * en `source_cache` con el resto de fuentes, así que cada entidad se consulta una vez al mes.
 */
@Injectable()
export class LinksService {
  private readonly agent = `Sintonia/0.1 (https://github.com/joseortega-hub/proyecto-w${config.musicBrainzContact ? `; ${config.musicBrainzContact}` : ''})`;
  private readonly wikidata = politeFetcher({ minIntervalMs: 1100, name: 'Wikidata', headers: { 'User-Agent': this.agent, Accept: 'application/json' } });
  /** Peticiones en curso: el resultado y la ficha pueden pedir la misma entidad a la vez. */
  private readonly inFlight = new Map<string, Promise<EntityLinks>>();

  /**
   * Comprobación de cada URL; los tests la sustituyen para no salir a la red. Con un User-Agent de
   * comprobador de enlaces que dice quién es: muchas webs oficiales rechazan los que no empiezan por "Mozilla".
   */
  verify = (url: string) => verifyUrl(url, fetch, 5000, { 'User-Agent': 'Mozilla/5.0 (compatible; SintoniaLinkCheck/0.1; +https://github.com/joseortega-hub/proyecto-w)' });

  constructor(
    private readonly sources: SourcesService,
    @Inject(DB) private readonly db: Db,
  ) {}

  /**
   * Enlaces de la lista de una sesión: su primera ancla que sea algo concreto (franquicia, autoría,
   * estudio u obra), no un estilo ("acción"). Solo lee la sesión; vacío si no hay ninguna.
   */
  async forSession(sessionId: string): Promise<EntityLinks> {
    const [row] = await this.db
      .select({ domainId: interviewSessions.domainId, anchors: interviewSessions.anchors })
      .from(interviewSessions)
      .where(eq(interviewSessions.id, sessionId));
    const anchor = sessionAnchor(row?.anchors ?? []);
    return row && anchor ? this.forEntity(row.domainId, anchor) : { query: '', entity: null, links: [] };
  }

  forEntity(domain: string, name: string): Promise<EntityLinks> {
    const q = norm(name);
    const empty: EntityLinks = { query: name, entity: null, links: [] };
    if (q.length < 2) return Promise.resolve(empty);
    const key = `links:${domain}:${q}`;
    const running = this.inFlight.get(key);
    if (running) return running;
    const task = this.sources.cached(key, empty, () => this.resolve(domain, name)).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, task);
    return task;
  }

  private async resolve(domain: string, name: string): Promise<EntityLinks> {
    const search = await this.wikidata<{ search?: { id: string }[] }>(
      `https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: 'wbsearchentities', search: name, language: 'es', uselang: 'es', type: 'item', limit: '5', format: 'json' })}`,
    );
    const ids = (search.search ?? []).map((s) => s.id);
    if (!ids.length) return { query: name, entity: null, links: [] };
    const body = await this.wikidata<{ entities?: Record<string, WikidataEntity> }>(
      `https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: 'wbgetentities', ids: ids.join('|'), props: 'labels|aliases|descriptions|claims|sitelinks', languages: 'es|mul|en', sitefilter: 'eswiki', format: 'json' })}`,
    );
    const entities = ids.map((id) => body.entities?.[id]).filter((e): e is WikidataEntity => !!e);
    const entity = pickEntity(name, domain, entities);
    if (!entity) return { query: name, entity: null, links: [] };
    const candidates = candidateLinks(entity, domain);
    const ok = await Promise.all(candidates.map((l) => this.verify(l.url)));
    return { query: name, entity: summarize(entity), links: candidates.filter((_, i) => ok[i]).slice(0, MAX_LINKS) };
  }
}

/** La primera ancla que nombra una entidad; los estilos y etiquetas ("acción") no tienen web propia. */
export function sessionAnchor(anchors: Pick<Anchor, 'label' | 'kind'>[]): string | null {
  return anchors.find((a) => a.kind !== 'tag' && a.label.trim().length >= 2)?.label.trim() ?? null;
}
