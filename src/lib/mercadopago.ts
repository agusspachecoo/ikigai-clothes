import type { CartItem } from '../types/cart'

interface ClientePago {
  nombre: string
  email: string
  telefono: string
  dni: string
}

const FUNCTIONS_URL = `${String(import.meta.env.VITE_SUPABASE_URL).replace(/\/$/, '')}/functions/v1`

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

  try {
    const res = await fetch(`${FUNCTIONS_URL}/create-preference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = (await res.json().catch(() => ({}))) as {
      init_point?: string
      error?: string
    }

    if (!res.ok) {
      return { init_point: null, error: data.error ?? 'No se pudo iniciar el pago.' }
    }

    return { init_point: data.init_point ?? null, error: null }
  } catch {
    return {
      init_point: null,
      error:
        'No se pudo contactar la pasarela de pago. Verificá que las Edge Functions estén desplegadas.',
    }
  }
}