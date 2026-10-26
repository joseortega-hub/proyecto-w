import { describe, expect, it } from 'vitest'
import { csvProblem, importProgress, importSummary } from './history'

describe('importar historial', () => {
  it('valida el archivo antes de subirlo', () => {
    expect(csvProblem({ name: 'ratings.csv', size: 2048 })).toBeNull()
    expect(csvProblem({ name: 'foto.png', size: 2048 })).toMatch(/\.csv/)
    expect(csvProblem({ name: 'vacio.csv', size: 0 })).toMatch(/vacío/)
    expect(csvProblem({ name: 'enorme.csv', size: 6 * 1024 * 1024 })).toMatch(/5 MB/)
  })

  it('resume la importación con el género del sustantivo', () => {
    expect(importSummary({ processed: 312, found: 280, notFound: 32 }, 'películas')).toBe('312 películas importadas, 280 encontradas, 32 sin encontrar')
    expect(importSummary({ processed: 10, found: 9, notFound: 1 }, 'libros', 'encontrados')).toBe('10 libros importados, 9 encontrados, 1 sin encontrar')
    expect(importProgress({ processed: 50, total: 200 })).toBe(0.25)
  })
})
