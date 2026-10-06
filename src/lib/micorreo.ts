// ============================================================
// Cliente de la Edge Function `micorreo-envio` (Correo Argentino / MiCorreo).
//
// Este módulo NO reemplaza hoy a `tarifasEnvio.ts`: el checkout sigue usando
// el tarifario local. Acá queda lista la invocación remota para cuando se
// decida el swap. Las credenciales viven en los secrets de la Edge Function,
// nunca en el bundle del navegador.
//
// Invocación: supabase.functions.invoke('micorreo-envio', { body: { action, ... } })
//   - action: 'rates'             -> cotización (POST /rates)
//   - action: 'shipping/import'   -> alta de envío (POST /shipping/import)
//   - action: 'shipping/tracking' -> seguimiento (GET /shipping/tracking)
// ============================================================

import { supabase } from './supabase'

export type TipoEntregaMicorreo = 'D' | 'S' | 'ambos'

/** Medidas del paquete por defecto (PRD): 30 × 20 × 5 cm / 300 g por prenda. */
export const DEF_PESO_G = 300
export const DEF_DIMENSIONES = { height: 5, width: 20, length: 30 } as const

export interface DimensionesMicorreo {
  /** Gramos (la API acepta de 1 a 25.000 g) */
  weight?: number
  height?: number
  width?: number
  length?: number
}

export interface CotizarMicorreoInput {
  postalCodeDestination: string
  postalCodeOrigin?: string
  /** 'D' domicilio | 'S' sucursal | 'ambos' (default: la API devuelve las dos) */
  deliveredType?: TipoEntregaMicorreo
  dimensions?: DimensionesMicorreo
  /** Default: CORREO_ARGENTINO_CUSTOMER_ID de la Edge Function */
  customerId?: string
}

/** Opción de envío tal como la devuelve MiCorreo + campos normalizados. */
export interface OpcionMicorreo {
  deliveredType?: string
  productType?: string
  productName?: string
  price?: number
  /** Alias de `price`, en pesos */
  costo: number | null
  tiempo_estimado: string | null
  /** Rango de entrega en días hábiles. Llegan del spread de la Edge Function:
   *  no los documenta el tipo de respuesta pero sí los devuelve la API. */
  deliveryTimeMin?: number | string | null
  deliveryTimeMax?: number | string | null
}

export type ResultadoCotizacionMicorreo =
  | { ok: true; rates: OpcionMicorreo[]; validTo: string | null }
  | { ok: false; error: string }

export interface ImportarEnvioMicorreoInput {
  extOrderId: string
  customerId?: string
  orderNumber?: string
  recipient: {
    nombre?: string
    apellido?: string
    name?: string
    email: string
    telefono?: string
    celular?: string
    /** MiCorreo no los recibe en /shipping/import: se ignoran */
    dni?: string
    cuit?: string
  }
  shipping: {
    deliveredType?: 'D' | 'S'
    direccion?: string
    altura?: string
    localidad?: string
    provincia?: string
    codigo_postal?: string
    agency?: string
    declaredValue?: number
    dimensions?: DimensionesMicorreo
  }
}

export interface SeguimientoMicorreo {
  ok: boolean
  shippingId: string
  [clave: string]: unknown
}

/**
 * Dimensiones del carrito: cada prenda pesa 300 g y entra en un paquete de
 * 30 × 20 × 5 cm (medidas del PRD). El peso se multiplica por la cantidad.
 */
export function dimensionesPorPrendas(cantidad: number): DimensionesMicorreo {
  const prendas = Math.max(1, Math.round(cantidad))
  return { weight: DEF_PESO_G * prendas, ...DEF_DIMENSIONES }
}

/**
 * Cotiza contra Correo Argentino vía la Edge Function `micorreo-envio`.
 * Devuelve `ok: false` con un mensaje amigable ante cualquier fallo: la
 * interfaz nunca tiene que tratar excepciones ni leer el error de red.
 */
export async function cotizarMicorreo(
  input: CotizarMicorreoInput,
): Promise<ResultadoCotizacionMicorreo> {
  const { data, error } = await supabase.functions.invoke('micorreo-envio', {
    body: { action: 'rates', ...input },
  })

  if (error) return { ok: false, error: await leerError(error, 'No pudimos cotizar el envío.') }

  const respuesta = data as { rates?: OpcionMicorreo[]; validTo?: string | null; error?: string } | null
  if (!respuesta?.rates) {
    return { ok: false, error: respuesta?.error ?? 'No pudimos cotizar el envío.' }
  }

  return {
    ok: true,
    rates: respuesta.rates,
    validTo: respuesta.validTo ?? null,
  }
}

/**
 * Importa un envío a MiCorreo (lo da de alta en la plataforma) y devuelve el
 * `createdAt` de la operación.
 */
export async function importarEnvioMicorreo(
  input: ImportarEnvioMicorreoInput,
): Promise<{ ok: boolean; createdAt?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('micorreo-envio', {
    body: { action: 'shipping/import', ...input },
  })

  if (error) return { ok: false, error: await leerError(error, 'No pudimos generar el envío.') }

  const respuesta = data as { createdAt?: string; error?: string } | null
  if (respuesta?.error || !respuesta?.createdAt) {
    return { ok: false, error: respuesta?.error ?? 'No pudimos generar el envío.' }
  }
  return { ok: true, createdAt: respuesta.createdAt }
}

/** Consulta el seguimiento de un envío ya importado (`shippingId`). */
export async function seguirEnvioMicorreo(shippingId: string): Promise<SeguimientoMicorreo> {
  const { data, error } = await supabase.functions.invoke('micorreo-envio', {
    body: { action: 'shipping/tracking', shippingId },
  })

  if (error) {
    return { ok: false, shippingId, error: await leerError(error, 'No pudimos consultar el seguimiento.') }
  }
  return { ok: true, shippingId, ...(data as Record<string, unknown>) }
}

/**
 * `supabase.functions.invoke` envuelve los errores de la función en un
 * `FunctionsHttpError` genérico. Intentamos leer el cuerpo para conservar el
 * mensaje real (por ejemplo "Ingresá un código postal válido...").
 */
async function leerError(error: { message: string; context?: Response }, fallback: string): Promise<string> {
  try {
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      const cuerpo = (await ctx.json()) as { error?: string }
      if (cuerpo?.error) return cuerpo.error
    }
  } catch {
    // si no se puede leer el cuerpo, caemos al mensaje genérico
  }
  return error.message || fallback
}
