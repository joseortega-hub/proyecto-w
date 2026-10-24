import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import type { TextProvider } from '../ai/text-provider.js';
import { moviesDomain } from '../domains/movies.domain.js';
import type { SourcesService } from '../sources/sources.service.js';
import { UnderstandingService } from './understanding.service.js';

const text = (anchors: unknown[]): TextProvider => ({ name: 'fake', write: async <T extends z.ZodType>() => ({ anchors, moods: [], preferences: [], exclusions: [] }) as z.infer<T> }) as TextProvider;
const potter = { label: 'Harry Potter', kind: 'franchise', terms: ['Harry Potter'], required: true };

describe('Wikidata amplía las franquicias que no están en el catálogo', () => {
  it('suma las obras reales a los términos del ancla', async () => {
    const sources = { franchiseWorks: async () => ['La piedra filosofal', 'La cámara secreta'] } as unknown as SourcesService;
    const u = await new UnderstandingService(text([potter]), sources).understand(moviesDomain, 'algo de Harry Potter');
    expect(u.anchors[0].terms).toEqual(expect.arrayContaining(['Harry Potter', 'La piedra filosofal', 'La cámara secreta']));
  });

  it('si Wikidata falla o no sabe, el ancla queda como estaba', async () => {
    for (const franchiseWorks of [async () => [], async () => Promise.reject(new Error('caído'))]) {
      const sources = { franchiseWorks } as unknown as SourcesService;
      const u = await new UnderstandingService(text([potter]), sources).understand(moviesDomain, 'algo de Harry Potter');
      expect(u.anchors[0].terms).toEqual(['Harry Potter']);
    }
  });
});
