import { describe, expect, it } from 'vitest'
import { changedLinks, compactPhoto } from './perreo-edit'

describe('compactPhoto', () => {
  it('usa WebP cuando el navegador sabe codificarlo', () => {
    expect(compactPhoto((type) => `data:${type};base64,AAA`)).toBe('AAA')
  })

  it('en Safari (sin WebP, devuelve PNG) pasa a JPEG en vez de mandar un PNG enorme', () => {
    const calls: string[] = []
    const out = compactPhoto((type) => {
      calls.push(type)
      return type === 'image/jpeg' ? 'data:image/jpeg;base64,JPG' : 'data:image/png;base64,PNGENORME'
    })
    expect(out).toBe('JPG')
    expect(calls).toEqual(['image/webp', 'image/jpeg'])
  })
})

describe('changedLinks', () => {
  const original = { instagram: ': https://www.instagram.com/daddyyankee', spotify: 'https://open.spotify.com/a' }

  it('no manda los enlaces que no se han tocado (aunque vengan sucios del import)', () => {
    expect(changedLinks(original, { instagram: original.instagram, youtubeMusic: '', spotify: original.spotify })).toBeUndefined()
  })

  it('manda solo lo cambiado, y vacío para borrar', () => {
    expect(changedLinks(original, { instagram: 'https://www.instagram.com/daddyyankee', youtubeMusic: '', spotify: '' })).toEqual({
      instagram: 'https://www.instagram.com/daddyyankee',
      spotify: '',
    })
  })
})
