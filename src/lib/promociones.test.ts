import { describe, expect, it } from 'vitest'
import {
  calcularPromociones,
  claveLinea,
  esPromocionVigente,
  type Promocion,
} from './promociones'

const AHORA = new Date('2026-10-29T12:00:00Z')

function promo(parcial: Partial<Promocion> & Pick<Promocion, 'id' | 'nombre' | 'tipo'>): Promocion {
  return {
    descuento_porcentaje: null,
    precio_fijo: null,
    prioridad: 0,
    activo: true,
    grupos: [],
    ...parcial,
  }
}

describe('esPromocionVigente', () => {
  it('respeta activo y ventana de fechas', () => {
    expect(esPromocionVigente(promo({ id: '1', nombre: 'A', tipo: 'pack' }), AHORA)).toBe(true)
    expect(
      esPromocionVigente(
        promo({ id: '1', nombre: 'A', tipo: 'pack', activo: false }),
        AHORA,
      ),
    ).toBe(false)
    expect(
      esPromocionVigente(
        promo({
          id: '1',
          nombre: 'A',
          tipo: 'pack',
          fecha_inicio: '2026-11-01T00:00:00Z',
        }),
        AHORA,
      ),
    ).toBe(false)
    expect(
      esPromocionVigente(
        promo({
          id: '1',
          nombre: 'A',
          tipo: 'pack',
          fecha_fin: '2026-10-01T00:00:00Z',
        }),
        AHORA,
      ),
    ).toBe(false)
  })
})

describe('calcularPromociones', () => {
  it('aplica un pack repetible usando las unidades más caras', () => {
    const resultado = calcularPromociones(
      [
        { producto_id: 'remera', talle: 'M', cantidad: 4, precio_unitario: 20_000 },
      ],
      [
        promo({
          id: 'pack-2x35',
          nombre: '2 remeras',
          tipo: 'pack',
          precio_fijo: 35_000,
          grupos: [{ cantidad_requerida: 2, producto_ids: ['remera'] }],
        }),
      ],
      AHORA,
    )

    expect(resultado.descuento).toBe(10_000)
    expect(resultado.aplicadas).toEqual([
      expect.objectContaining({ promocion_id: 'pack-2x35', packs: 2, descuento: 10_000 }),
    ])
    expect(resultado.unidadesConsumidas.get(claveLinea({ producto_id: 'remera', talle: 'M' }))).toBe(4)
  })

  it('no aplica el pack si el precio fijo no genera ahorro', () => {
    const resultado = calcularPromociones(
      [{ producto_id: 'remera', talle: 'M', cantidad: 2, precio_unitario: 15_000 }],
      [
        promo({
          id: 'pack-2x35',
          nombre: '2 remeras',
          tipo: 'pack',
          precio_fijo: 35_000,
          grupos: [{ cantidad_requerida: 2, producto_ids: ['remera'] }],
        }),
      ],
      AHORA,
    )

    expect(resultado.descuento).toBe(0)
    expect(resultado.aplicadas).toEqual([])
  })

  it('aplica un combo cruzado sobre las unidades seleccionadas', () => {
    const resultado = calcularPromociones(
      [
        { producto_id: 'remera', talle: 'M', cantidad: 1, precio_unitario: 20_000 },
        { producto_id: 'pantalon', talle: '40', cantidad: 1, precio_unitario: 40_000 },
      ],
      [
        promo({
          id: 'combo-15',
          nombre: 'Remera + Pantalón',
          tipo: 'combo',
          descuento_porcentaje: 15,
          grupos: [
            { cantidad_requerida: 1, producto_ids: ['remera'] },
            { cantidad_requerida: 1, producto_ids: ['pantalon'] },
          ],
        }),
      ],
      AHORA,
    )

    expect(resultado.descuento).toBe(9_000)
    expect(resultado.aplicadas[0]).toEqual(
      expect.objectContaining({ promocion_id: 'combo-15', conjuntos: 1, descuento: 9_000 }),
    )
  })

  it('prioriza la promo de mayor prioridad y no reutiliza unidades', () => {
    const resultado = calcularPromociones(
      [
        { producto_id: 'remera', talle: 'M', cantidad: 2, precio_unitario: 20_000 },
        { producto_id: 'pantalon', talle: '40', cantidad: 1, precio_unitario: 40_000 },
      ],
      [
        promo({
          id: 'pack',
          nombre: 'Pack',
          tipo: 'pack',
          precio_fijo: 35_000,
          prioridad: 10,
          grupos: [{ cantidad_requerida: 2, producto_ids: ['remera'] }],
        }),
        promo({
          id: 'combo',
          nombre: 'Combo',
          tipo: 'combo',
          descuento_porcentaje: 50,
          prioridad: 5,
          grupos: [
            { cantidad_requerida: 1, producto_ids: ['remera'] },
            { cantidad_requerida: 1, producto_ids: ['pantalon'] },
          ],
        }),
      ],
      AHORA,
    )

    expect(resultado.aplicadas.map((p) => p.promocion_id)).toEqual(['pack'])
    expect(resultado.descuento).toBe(5_000)
  })

  it('ignora promos inactivas o fuera de fecha', () => {
    const resultado = calcularPromociones(
      [{ producto_id: 'remera', talle: 'M', cantidad: 2, precio_unitario: 20_000 }],
      [
        promo({
          id: 'pack',
          nombre: 'Pack',
          tipo: 'pack',
          precio_fijo: 35_000,
          activo: false,
          grupos: [{ cantidad_requerida: 2, producto_ids: ['remera'] }],
        }),
      ],
      AHORA,
    )

    expect(resultado.descuento).toBe(0)
  })

  it('calcula el ahorro real del pack', () => {
    const resultado = calcularPromociones(
      [{ producto_id: 'remera', talle: 'M', cantidad: 2, precio_unitario: 10_000 }],
      [
        promo({
          id: 'pack',
          nombre: 'Pack',
          tipo: 'pack',
          precio_fijo: 1,
          grupos: [{ cantidad_requerida: 2, producto_ids: ['remera'] }],
        }),
      ],
      AHORA,
    )

    expect(resultado.descuento).toBe(19_999)
  })
})
