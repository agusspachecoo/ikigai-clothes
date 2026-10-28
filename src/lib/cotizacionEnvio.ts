// ============================================================
// Cotización de envío server-side.
//
// La Edge Function `cotizar-envio` valida el CP, consulta MiCorreo con
// fallback local y devuelve cada opción firmada con un `quote_token`.
// `crear-orden` vuelve a verificar esa firma: el navegador no puede cambiar
// el costo del envío entre la cotización y la compra.
//
// Este módulo ya no cae al tarifario local: una cotización sin firma no sirve
// para crear la orden.
// ============================================================

import { supabase } from './supabase'
import type { ResultadoCotizacion } from './enviopack'
import type { CartItem } from '../types/cart'

export async function cotizarEnvio(
  destinoCp: string,
  items: CartItem[],
  subtotal?: number,
): Promise<ResultadoCotizacion> {
  const cp = String(destinoCp ?? '').trim().replace(/\D/g, '')

  const error = (mensaje: string): ResultadoCotizacion => ({
    codigo_postal: cp,
    origen_cp: null,
    provincia: null,
    destino: null,
    paquetes: '',
    peso: null,
    opciones: [],
    mock: true,
    error: mensaje,
  })

  if (cp.length < 4) {
    return error('El código postal debe tener al menos 4 dígitos.')
  }
  if (items.length === 0) {
    return error('El carrito está vacío.')
  }

  const { data, error: errFuncion } = await supabase.functions.invoke('cotizar-envio', {
    body: {
      codigo_postal: cp,
      items: items.map((i) => ({
        producto_id: i.producto_id,
        talle: i.talle,
        cantidad: i.cantidad,
      })),
      subtotal:
        typeof subtotal === 'number'
          ? subtotal
          : items.reduce((n, i) => n + i.precio_unitario * i.cantidad, 0),
    },
  })

  if (errFuncion) {
    return error(await leerError(errFuncion, 'No pudimos cotizar el envío.'))
  }

  const respuesta = data as (ResultadoCotizacion & { error?: string }) | null
  if (!respuesta) return error('No pudimos cotizar el envío.')
  // Si la Edge Function reportó error (CP inexistente, sin cobertura, etc.)
  // nunca se devuelven opciones: el frontend no debe mostrar precios de un
  // código postal que no tiene cobertura logística.
  if (respuesta.error) {
    return { ...respuesta, opciones: [] }
  }

  return {
    ...respuesta,
    opciones: Array.isArray(respuesta.opciones) ? respuesta.opciones : [],
  }
}

async function leerError(
  error: { message: string; context?: Response },
  fallback: string,
): Promise<string> {
  try {
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      const cuerpo = (await ctx.json()) as { error?: string }
      if (cuerpo?.error) return cuerpo.error
    }
  } catch {
    // Cuerpo no JSON: mensaje genérico.
  }
  return error.message || fallback
}
