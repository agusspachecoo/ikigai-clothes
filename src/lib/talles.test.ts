import { describe, expect, it } from 'vitest'
import { ordenarTalles } from './talles'

describe('ordenarTalles', () => {
  it('ordena letras con la curva habitual', () => {
    expect(ordenarTalles(['XL', 'S', 'M', 'L', 'XS'])).toEqual(['XS', 'S', 'M', 'L', 'XL'])
  })

  it('ordena talles numericos de menor a mayor', () => {
    expect(ordenarTalles(['44', '38', '42', '40', '46'])).toEqual([
      '38',
      '40',
      '42',
      '44',
      '46',
    ])
  })

  it('respeta la lista maestra cuando viene del panel', () => {
    expect(ordenarTalles(['L', 'S', 'M'], ['M', 'L', 'S'])).toEqual(['M', 'L', 'S'])
  })

  it('deja los talles desconocidos al final, ordenados', () => {
    expect(ordenarTalles(['99', 'M', '50', 'S'])).toEqual(['S', 'M', '50', '99'])
  })
})
