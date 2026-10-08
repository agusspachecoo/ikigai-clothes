// ============================================================
// Cotización de envío: MiCorreo con fallback al tarifario local.
//
// Una sola entrada para la UI (`Checkout.tsx` y `EnvioCalculator.tsx`):
//
//   cotizarEnvio(cp, items)
//
// Orden de resolución:
//   1. Cotiza contra Correo Argentino vía la Edge Function `micorreo-envio`.
//   2. Si responde en menos de 4 s y trae al menos un rate de Clásico,
//      se usa ese precio tal cual (sin recargos ni subsidios).
//   3. En cualquier otro caso (red caída, timeout, sin cobertura, sólo
//      servicios que no son Clásico) se cae al tarifario local.
//
// El fallback es invisible para el cliente: no hay cartel ni cambio de copy.
// Lo único que lo delata es `mock: true` en el resultado, que `PedidosAdmin`
// ya muestra para distinguir tarifario real de tabla local.
// ============================================================

import { cotizarMicorreo, dimensionesPorPrendas, type OpcionMicorreo } from './micorreo'
import { ratesACpciones } from './mapeoMicorreo'
import {
  cotizarEnvioLocal,
  provinciaPorCP,
  ORIGEN_CP,
  type OpcionEnvio,
  type ResultadoCotizacion,
} from './tarifasEnvio'
import type { CartItem } from '../types/cart'

/** Cortamiape de la llamada a MiCorreo. Si tarda más, manda el local. */
export const TIMEOUT_MICORREO_MS = 4000

/**
 * Cotiza el envío de `items` hacia `destinoCp`.
 *
 * Nunca rechaza: siempre devuelve un `ResultadoCotizacion` listo para pintar.
 * El caller no tiene que tratar excepciones ni distinguir de dónde vino el
 * precio — salvo que le interese `resultado.mock`.
 */
export async function cotizarEnvio(
  destinoCp: string,
  items: CartItem[],
): Promise<ResultadoCotizacion> {
  const cp = String(destinoCp ?? '').trim().replace(/\D/g, '')

  // OVERRIDE DIRECTO - Envío gratis para Oberá (CP 3360)
  if (cp === '3360') {
    return cotizarEnvioLocal(cp, items)
  }

  // El CP corto es un error de tipeo, no un fallo del carrier: sin red.
  if (cp.length < 4) {
    return cotizarEnvioLocal(cp, items)
  }

  const remote = await cotizarConTimeout(cp, items)
  if (remote) return remote

  return conMock(cotizarEnvioLocal(cp, items))
}

/**
 * Intenta la vía remota. Devuelve `null` en cualquier caso que amerite el
 * fallback: red, timeout, respuesta malformada o ausencia de cobertura.
 *
 * El `Promise.race` no aborta la llamada en curso (supabase-js no expone
 * signal en `invoke`), pero el resultado tardío se descarta y la petición
 * es de sólo lectura, así que no hay efecto colateral.
 */
async function cotizarConTimeout(
  cp: string,
  items: CartItem[],
): Promise<ResultadoCotizacion | null> {
  const cantidad = items.reduce((n, i) => n + i.cantidad, 0)
  if (cantidad <= 0) return null

  const llamada = cotizarMicorreo({
    postalCodeDestination: cp,
    postalCodeOrigin: ORIGEN_CP || undefined,
    deliveredType: 'ambos',
    dimensions: dimensionesPorPrendas(cantidad),
  })

  // Si el timeout gana, la promesa perdedora puede rechazar más adelante y
  // Node/React la reportaría como unhandled rejection. Se traga acá.
  const protegida = llamada.then(
    (r) => r,
    (e: unknown) => ({ ok: false as const, error: String(e) }),
  )

  const resultado = await Promise.race([
    protegida,
    esperar(TIMEOUT_MICORREO_MS).then(() => 'timeout' as const),
  ])

  if (resultado === 'timeout') return null
  if (!resultado.ok) return null

  const opciones = ratesACpciones(resultado.rates as OpcionMicorreo[])
  if (opciones.length === 0) return null

  return armarResultado(cp, opciones, cantidad)
}

/** Arma el `ResultadoCotizacion` con los mismos campos que el tarifario local. */
function armarResultado(
  cp: string,
  opciones: OpcionEnvio[],
  bultos: number,
): ResultadoCotizacion {
  const provincia = provinciaPorCP(cp)

  return {
    codigo_postal: cp,
    origen_cp: ORIGEN_CP || null,
    provincia,
    destino: { city: null, state: provincia },
    paquetes: `${bultos} bulto${bultos === 1 ? '' : 's'} de 30×20×5 cm`,
    peso: Number(((bultos * 300) / 1000).toFixed(2)),
    opciones,
    mock: false,
  }
}

function conMock(res: ResultadoCotizacion): ResultadoCotizacion {
  return { ...res, mock: true }
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
