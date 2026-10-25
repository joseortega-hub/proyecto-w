import { describe, expect, it } from 'vitest'
import { pickSlot, sameRect } from './video-slot'

const slot = (top: number, left: number, width: number, height: number, visible = true) => ({
  getBoundingClientRect: () => ({ top, left, width, height }),
  checkVisibility: () => visible,
})

describe('pickSlot', () => {
  it('elige el hueco visible más grande', () => {
    expect(pickSlot([slot(0, 0, 40, 40), slot(100, 0, 300, 170)], 400, 800)).toEqual({ top: 100, left: 0, width: 300, height: 170 })
  })

  it('ignora huecos ocultos, vacíos o fuera de la pantalla', () => {
    expect(pickSlot([slot(0, 0, 300, 170, false), slot(0, 0, 0, 0), slot(900, 0, 100, 60), slot(-80, 0, 100, 60)], 400, 800)).toBeNull()
  })

  it('sin huecos no hay sitio', () => {
    expect(pickSlot([], 400, 800)).toBeNull()
  })
})

describe('sameRect', () => {
  it('tolera medio píxel', () => {
    expect(sameRect({ top: 1, left: 1, width: 10, height: 10 }, { top: 1.2, left: 1, width: 10, height: 10 })).toBe(true)
    expect(sameRect({ top: 1, left: 1, width: 10, height: 10 }, { top: 3, left: 1, width: 10, height: 10 })).toBe(false)
    expect(sameRect(null, null)).toBe(true)
    expect(sameRect(null, { top: 0, left: 0, width: 1, height: 1 })).toBe(false)
  })
})
