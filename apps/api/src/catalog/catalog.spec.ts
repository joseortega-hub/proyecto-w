import { musicDomain } from '../domains/music.domain.js';
import { facetValues } from './classify-facets.js';
import { languageFacet } from './jamendo.adapter.js';

describe('idioma de la letra', () => {
  it('lee el idioma de Jamendo y marca las instrumentales', () => {
    expect(languageFacet({ vocalinstrumental: 'vocal', lang: 'es' })).toBe('es');
    expect(languageFacet({ vocalinstrumental: 'vocal', lang: 'EN' })).toBe('en');
    expect(languageFacet({ vocalinstrumental: 'vocal', lang: 'fr' })).toBe('other');
    expect(languageFacet({ vocalinstrumental: 'instrumental', lang: 'es' })).toBe('instrumental');
  });

  it('sin idioma en una pista con voz, queda pendiente de clasificar', () => {
    expect(languageFacet({ vocalinstrumental: 'vocal', lang: '' })).toBeNull();
    expect(languageFacet(undefined)).toBeNull();
  });

  it('la clasificación ofrece los valores del dominio sin "me da igual"', () => {
    const [language] = musicDomain.config.preferences!;
    expect(facetValues(language)).toEqual(['es', 'en', 'instrumental', 'other']);
  });
});
