import { describe, expect, it } from 'vitest'
import { changedLinks, compactPhoto, labelLines, lines, parseLabelLines, photoUrl } from './perreo-edit'

describe('photoUrl', () => {
  it('cambia de URL cuando cambia la foto (huella del servidor), para saltarse la caché de un día', () => {
    const before = photoUrl({ slug: 'bad-bunny', photoV: 'aaa' })
    const after = photoUrl({ slug: 'bad-bunny', photoV: 'bbb' })
    expect(before).toBe('/api/perreo/artists/bad-bunny/photo?v=aaa')
    expect(after).not.toBe(before)
    expect(photoUrl({ slug: 'x', photoV: null })).toBe('/api/perreo/artists/x/photo')
  })
})

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

describe('sellos con años', () => {
  it('entiende «Nombre (2016–2020)», «(2018–hoy)» y conserva los años de lo que no toca', () => {
    const prev = [{ name: 'WY Records', start: 2004, end: null }]
    expect(parseLabelLines(['Rimas (2016–2020)', 'Hear This (2018-hoy)', 'WY Records', '', ''].join('\n'), prev)).toEqual([
      { name: 'Rimas', start: 2016, end: 2020 },
      { name: 'Hear This', start: 2018, end: null },
      { name: 'WY Records', start: 2004, end: null },
    ])
  })

  it('ida y vuelta sin perder nada', () => {
    const ls = [{ name: 'Rimas', start: 2016, end: 2020 }, { name: 'Sin años', start: null, end: null }]
    expect(parseLabelLines(labelLines(ls))).toEqual(ls)
  })

  it('lines quita vacías y repetidas', () => {
    expect(lines([' El Duro ', 'el duro', '', 'W'].join('\n'))).toEqual(['El Duro', 'W'])
  })
})
