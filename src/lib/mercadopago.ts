import type { CartItem } from '../types/cart'

interface ClientePago {
  nombre: string
  email: string
  telefono: string
  dni: string
}

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '')
const FUNCTIONS_URL = `${supabaseUrl}/functions/v1`

export async function crearPreferenciaMP(ordenId: string, items: CartItem[], cliente: ClientePago) {
  const base = window.location.origin

  const body = {
    ordenId,
    items: items.map((i) => ({
      producto_id: i.producto_id,
      nombre: i.nombre,
      talle: i.talle,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
    })),
    cliente,
    urls: {
      back: {
        success: `${base}/checkout/success`,
        failure: `${base}/checkout/failure`,
        pending: `${base}/checkout/pending`,
      },
      notification: `${FUNCTIONS_URL}/mercadopago-webhook`,
    },
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      init_point: null,
      error: 'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY configurados.',
    }
  }

  try {
    const res = await fetch(`${FUNCTIONS_URL}/create-preference`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(body),
    })

    const data = (await res.json().catch(() => ({}))) as {
      init_point?: string
      error?: string
    }

    if (!res.ok) {
      const detalle =
        res.status === 401
          ? 'No autorizado. Verificá la API Key de Supabase (VITE_SUPABASE_ANON_KEY).'
          : data.error ?? 'No se pudo iniciar el pago.'
      return { init_point: null, error: detalle }
    }

    return { init_point: data.init_point ?? null, error: null }
  } catch {
    return {
      init_point: null,
      error:
        'No se pudo contactar la pasarela de pago. Verificá que las Edge Functions estén desplegadas y que el CORS sea correcto.',
    }
  }
}