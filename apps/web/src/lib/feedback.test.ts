import { describe, expect, it } from 'vitest'
import { domainFromPath, feedbackProblem, fitWithin, MAX_IMAGE_CHARS, MAX_IMAGES, splitDataUrl } from './feedback'

describe('fitWithin', () => {
  it('reduce por el lado mayor sin deformar y nunca amplía', () => {
    expect(fitWithin(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 })
    expect(fitWithin(1170, 2532, 1600)).toEqual({ width: 739, height: 1600 })
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })
})

describe('splitDataUrl', () => {
  it('separa tipo y base64 de las imágenes admitidas', () => {
    expect(splitDataUrl('data:image/webp;base64,UklGRg==')).toEqual({ type: 'image/webp', data: 'UklGRg==' })
    // Safari antiguo devuelve PNG si no sabe hacer WebP: también vale.
    expect(splitDataUrl('data:image/png;base64,iVBORw0KGgo=')?.type).toBe('image/png')
    expect(splitDataUrl('data:image/gif;base64,R0lGOD')).toBeNull()
  })
})

describe('feedbackProblem', () => {
  const img = (n: number) => ({ type: 'image/jpeg' as const, data: 'A'.repeat(n) })
  it('pide texto y respeta los límites de imágenes', () => {
    expect(feedbackProblem({ message: ' ', images: [] })).toMatch(/más/)
    expect(feedbackProblem({ message: 'La barra se chafa', images: [] })).toBeNull()
    expect(feedbackProblem({ message: 'Fotos', images: Array.from({ length: MAX_IMAGES + 1 }, () => img(10)) })).toMatch(/Como mucho/)
    expect(feedbackProblem({ message: 'Grande', images: [img(MAX_IMAGE_CHARS + 1)] })).toMatch(/demasiado grande/)
    expect(feedbackProblem({ message: 'Entre todas', images: [img(MAX_IMAGE_CHARS), img(MAX_IMAGE_CHARS), img(MAX_IMAGE_CHARS)] })).toMatch(/entre todas/)
  })
})

describe('domainFromPath', () => {
  it('saca la temática de la ruta', () => {
    expect(domainFromPath('/games/biblioteca/1', ['games', 'music'])).toBe('games')
    expect(domainFromPath('/historia', ['games', 'music'])).toBeUndefined()
    expect(domainFromPath('/', ['games'])).toBeUndefined()
  })
})
