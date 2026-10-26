import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYOUT, getLayout, layoutNotice, parseLayout, setLayout } from './layout'

describe('parseLayout', () => {
  it('acepta las estructuras conocidas y vuelve a la clásica si no', () => {
    expect(parseLayout('dock')).toBe('dock')
    expect(parseLayout('library')).toBe('library')
    expect(parseLayout('radial-viejo')).toBe(DEFAULT_LAYOUT)
    expect(parseLayout(null)).toBe(DEFAULT_LAYOUT)
  })
})

describe('layoutNotice', () => {
  it('avisa fuera de las temáticas y en el Modo Perreo, donde la estructura no se ve', () => {
    expect(layoutNotice('', 'dock')?.title).toBe('Estructura «Dock» guardada')
    expect(layoutNotice('perreo', 'library')?.description).toMatch(/Modo Perreo/)
  })
  it('no avisa dentro de una temática, donde el cambio ya se ve', () => {
    expect(layoutNotice('music', 'dock')).toBeNull()
  })
})

describe('setLayout', () => {
  it('ignora valores inválidos y vuelve a la clásica', () => {
    setLayout('dock')
    expect(getLayout()).toBe('dock')
    setLayout('radial' as never)
    expect(getLayout()).toBe(DEFAULT_LAYOUT)
  })
})
