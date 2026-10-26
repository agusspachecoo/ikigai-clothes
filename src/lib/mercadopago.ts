import { supabase } from './supabase'

export const MERCADOPAGO_PUBLIC_KEY = String(
  import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY ?? '',
)

/**
 * Crea la preferencia de Checkout Pro.
 *
 * El navegador manda solo el ID del pedido y, si es invitado, su token. Los
 * ítems, precios, envío y datos del pagador los lee `create-preference` desde
 * `orden_items` y `ordenes`.
 */
export async function crearPreferenciaMP(
  ordenId: string,
  ordenToken?: string | null,
): Promise<{ init_point: string | null; error: string | null }> {
  if (!ordenId) return { init_point: null, error: 'Falta el ID del pedido.' }

  try {
    const { data, error } = await supabase.functions.invoke('create-preference', {
      body: {
        ordenId,
        ordenToken: ordenToken || undefined,
      },
    })

    if (error) {
      return { init_point: null, error: await leerError(error) }
    }

    const respuesta = (data ?? {}) as { init_point?: string; error?: string }
    if (!respuesta.init_point) {
      return {
        init_point: null,
        error: respuesta.error ?? 'No se pudo iniciar el pago.',
      }
    }

    return { init_point: respuesta.init_point, error: null }
  } catch {
    return {
      init_point: null,
      error:
        'No se pudo contactar la pasarela de pago. Verificá que las Edge Functions estén desplegadas y que el CORS sea correcto.',
    }
  }
}

async function leerError(error: { message: string; context?: Response }): Promise<string> {
  try {
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      const cuerpo = (await ctx.json()) as { error?: string }
      if (cuerpo?.error) return cuerpo.error
    }
  } catch {
    // sin cuerpo legible
  }
  return error.message || 'No se pudo iniciar el pago.'
}
