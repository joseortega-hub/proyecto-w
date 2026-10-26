import { describe, expect, it } from 'vitest'
import { cycleIndex, DEFAULT_LAYOUT, getLayout, layoutNotice, nextChrome, parseLayout, setLayout, swipeStep } from './layout'

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

describe('estructuras nuevas y valores antiguos', () => {
  it('conoce «Una mano» y «Enfoque»', () => {
    expect(parseLayout('thumb')).toBe('thumb')
    expect(parseLayout('focus')).toBe('focus')
  })
  it('traduce nombres antiguos a la estructura que los sustituye', () => {
    expect(parseLayout('rail')).toBe('library')
    expect(parseLayout('one-hand')).toBe('thumb')
    expect(parseLayout('toString')).toBe(DEFAULT_LAYOUT)
  })
})

describe('swipeStep y cycleIndex', () => {
  it('solo cuenta deslizamientos horizontales claros', () => {
    expect(swipeStep(-80, 10)).toBe(1)
    expect(swipeStep(80, 10)).toBe(-1)
    expect(swipeStep(30, 0)).toBe(0)
    expect(swipeStep(70, 60)).toBe(0)
  })
  it('da la vuelta en los extremos', () => {
    expect(cycleIndex(0, -1, 4)).toBe(3)
    expect(cycleIndex(3, 1, 4)).toBe(0)
    expect(cycleIndex(0, 1, 0)).toBe(0)
  })
})

describe('nextChrome', () => {
  const run = (ys: number[]) => ys.reduce((s, y) => nextChrome(s, y), { hidden: false, anchor: 0 })
  it('esconde al bajar en trocitos pequeños y enseña al subir', () => {
    expect(run([60, 64, 68, 72, 76, 80]).hidden).toBe(true)
    expect(run([60, 100, 200, 190, 180]).hidden).toBe(false)
  })
  it('no parpadea con movimientos pequeños', () => {
    expect(run([100, 200, 195, 199, 194]).hidden).toBe(true)
  })
  it('cerca del principio siempre se ven', () => {
    expect(run([100, 300, 40]).hidden).toBe(false)
  })
})
