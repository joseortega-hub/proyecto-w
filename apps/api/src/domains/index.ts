import { booksDomain } from './books.domain.js';
import type { DomainDefinition } from './domain.types.js';
import { gamesDomain } from './games.domain.js';
import { moviesDomain } from './movies.domain.js';
import { musicDomain } from './music.domain.js';
import { youtubeDomain } from './youtube.domain.js';

/** Todos los dominios, en el orden en que se muestran en el selector. */
export const domainDefinitions: DomainDefinition[] = [musicDomain, youtubeDomain, gamesDomain, moviesDomain, booksDomain];

export const findDomain = (id: string) => domainDefinitions.find((d) => d.id === id);
