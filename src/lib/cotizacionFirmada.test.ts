import { describe, expect, it } from 'vitest'
import {
  ORIGEN_CP,
  cotizarLocal,
  firmarCotizacion,
  hashCarrito,
  verificarCotizacion,
  type QuotePayload,
} from '../../supabase/functions/_shared/envio'

const SECRET = 'secreto-de-prueba-con-mas-de-32-chars'

function payload(overrides: Partial<QuotePayload> = {}): QuotePayload {
  return {
    v: 1,
    cp: '5000',
    items_hash: 'hash',
    costo: 5800,
    carrier: 'MiCorreo',
    carrier_id: 1,
    servicio: 'Domicilio',
    service_type: 'micorreo-domicilio',
    logistic_type: 'delivery',
    tiempo: '2 a 4 días',
    mock: false,
    exp: Date.now() + 60_000,
    ...overrides,
  }
}

describe('hashCarrito', () => {
  it('ignora el orden de los ítems y normaliza la cantidad', async () => {
    const a = await hashCarrito([
      { producto_id: 'p1', talle: 'M', cantidad: 1 },
      { producto_id: 'p2', talle: 'L', cantidad: 2 },
    ])
    const b = await hashCarrito([
      { producto_id: 'p2', talle: 'L', cantidad: 2 },
      { producto_id: 'p1', talle: 'M', cantidad: 1 },
    ])
    const c = await hashCarrito([
      { producto_id: 'p1', talle: 'M', cantidad: 0 },
      { producto_id: 'p2', talle: 'L', cantidad: 2 },
    ])

    expect(a).toBe(b)
    expect(a).toBe(c)
  })

  it('cambia si cambia el producto, el talle o la cantidad', async () => {
    const base = await hashCarrito([{ producto_id: 'p1', talle: 'M', cantidad: 1 }])

    expect(await hashCarrito([{ producto_id: 'p2', talle: 'M', cantidad: 1 }])).not.toBe(base)
    expect(await hashCarrito([{ producto_id: 'p1', talle: 'L', cantidad: 1 }])).not.toBe(base)
    expect(await hashCarrito([{ producto_id: 'p1', talle: 'M', cantidad: 2 }])).not.toBe(base)
  })
})

describe('firma de cotización', () => {
  it('acepta una cotización válida y devuelve el payload intacto', async () => {
    const original = payload()
    const token = await firmarCotizacion(original, SECRET)

    expect(await verificarCotizacion(token, SECRET)).toEqual(original)
  })

  it('rechaza otro secreto', async () => {
    const token = await firmarCotizacion(payload(), SECRET)

    expect(await verificarCotizacion(token, 'otro-secreto-con-mas-de-32-chars')).toBeNull()
  })

  it('rechaza una cotización vencida', async () => {
    const token = await firmarCotizacion(payload({ exp: Date.now() - 1 }), SECRET)

    expect(await verificarCotizacion(token, SECRET)).toBeNull()
  })

  it('rechaza un payload alterado', async () => {
    const token = await firmarCotizacion(payload(), SECRET)
    const [cuerpo, firma] = token.split('.')

    expect(await verificarCotizacion(`${cuerpo}.${firma}x`, SECRET)).toBeNull()
    expect(await verificarCotizacion(cuerpo, SECRET)).toBeNull()
    expect(await verificarCotizacion(null, SECRET)).toBeNull()
  })

  it('rechaza secretos cortos en lugar de firmar con poca entropía', async () => {
    const token = await firmarCotizacion(payload(), SECRET)

    expect(await verificarCotizacion(token, 'corto')).toBeNull()
    expect(await verificarCotizacion(token, '')).toBeNull()
  })
})

describe('cotizarLocal', () => {
  it('marca envío gratis en el CP del local', () => {
    const res = cotizarLocal(ORIGEN_CP, 1)

    expect(res.opciones.length).toBeGreaterThan(0)
    expect(res.opciones.every((o) => o.costo === 0)).toBe(true)
  })

  it('cobra más por cada bulto adicional', () => {
    const uno = cotizarLocal('5000', 1).opciones[0]!.costo
    const dos = cotizarLocal('5000', 2).opciones[0]!.costo

    expect(dos).toBeGreaterThan(uno)
  })
})
