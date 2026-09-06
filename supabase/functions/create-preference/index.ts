// ============================================================
// IKIGAI CLOTHES - create-preference
// Crear la preferencia de pago de Mercado Pago para un pedido.
//
// Requiere el secret: MERCADOPAGO_ACCESS_TOKEN
// (Supabase Dashboard -> Edge Functions -> Secrets, o `supabase secrets set`).
//
// Sudá de seguridad: valida el total de los ítems contra el monto
// guardado en la tabla `ordenes` (no confía 100% en lo que envía el cliente).
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

interface ItemInput {
  producto_id: string
  nombre: string
  talle?: string
  cantidad: number
  precio_unitario: number
}

function getSupabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key)
}

const hostLocales = ['localhost', '127.0.0.1', '0.0.0.0']

function esUrlPublica(url: string) {
  try {
    const u = new URL(url)
    return (u.protocol === 'https:' || u.protocol === 'http:') && !hostLocales.includes(u.hostname)
  } catch {
    return false
  }
}

// Prioridad: secret STORE_URL (URL de producción en Vercel) -> back_urls enviadas por el cliente.
// Nunca se usan URLs locales en las URLs de retorno de Mercado Pago.
function obtenerBackUrls(back: { success?: string; failure?: string; pending?: string } | undefined) {
  const store = (Deno.env.get('STORE_URL') ?? '').replace(/\/$/, '')

  if (store && esUrlPublica(store)) {
    return {
      success: `${store}/checkout/success`,
      failure: `${store}/checkout/failure`,
      pending: `${store}/checkout/pending`,
    }
  }

  if (
    back &&
    esUrlPublica(back.success ?? '') &&
    esUrlPublica(back.failure ?? '') &&
    esUrlPublica(back.pending ?? '')
  ) {
    return { success: back.success, failure: back.failure, pending: back.pending }
  }

  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
    if (!accessToken) {
      return json(
        { error: 'MERCADOPAGO_ACCESS_TOKEN no configurado en las secrets de Edge Functions.' },
        { status: 500 },
      )
    }

    const body = await req.json()
    const { ordenId, items, cliente, urls } = body

    if (!ordenId || !Array.isArray(items) || items.length === 0) {
      return json({ error: 'Faltan datos: ordenId e items son obligatorios.' }, { status: 400 })
    }

    const backUrls = obtenerBackUrls(urls?.back)
    if (!backUrls) {
      return json(
        {
          error:
            'back_urls inválidas. Configurá la secret STORE_URL con la URL de producción en Vercel (ej: https://ikigai-store-omega.vercel.app).',
        },
        { status: 400 },
      )
    }

    if (!urls?.notification) {
      return json({ error: 'Falta la URL de notificaciones (webhook).' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Validar que el pedido exista y que el monto coincida
    const { data: orden } = await supabase
      .from('ordenes')
      .select('monto_total, cliente_nombre, cliente_email, cliente_telefono, cliente_dni')
      .eq('id', ordenId)
      .maybeSingle()

    if (!orden) {
      return json({ error: 'El pedido no existe.' }, { status: 404 })
    }

    const montoCliente = (items as ItemInput[]).reduce(
      (n, i) => n + Number(i.cantidad) * Number(i.precio_unitario),
      0,
    )
    if (Math.round(Number(orden.monto_total)) !== Math.round(montoCliente)) {
      return json({ error: 'El monto de los ítems no coincide con el pedido.' }, { status: 409 })
    }

    // API oficial de Mercado Pago (Checkout Pro): crear preferencia
    const mpBody = {
      statement_descriptor: 'IKIGAI CLOTHES',
      items: (items as ItemInput[]).map((i) => ({
        id: i.producto_id,
        title: i.talle ? `${i.nombre} - Talle ${i.talle}` : i.nombre,
        quantity: Number(i.cantidad),
        unit_price: Number(i.precio_unitario),
        currency_id: 'ARS',
      })),
      payer: {
        name: cliente?.nombre ?? orden.cliente_nombre,
        email: cliente?.email ?? orden.cliente_email,
        phone: {
          area_code: '54',
          number: String(cliente?.telefono ?? orden.cliente_telefono)
            .replace(/\D/g, '')
            .replace(/^54/, '')
            .slice(0, 10),
        },
        identification: {
          type: 'DNI',
          number: String(cliente?.dni ?? orden.cliente_dni).replace(/\D/g, ''),
        },
      },
      external_reference: String(ordenId),
      back_urls: backUrls,
      auto_return: 'approved',
      notification_url: urls.notification,
    }

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mpBody),
    })

    const mpData = await mpRes.json()

    if (!mpRes.ok) {
      console.error('Mercado Pago error:', mpRes.status, JSON.stringify(mpData))
      return json(
        { error: mpData?.message ?? 'No se pudo crear la preferencia de pago.' },
        { status: mpRes.status >= 400 && mpRes.status < 600 ? mpRes.status : 500 },
      )
    }

    const initPoint = mpData.init_point ?? mpData.sandbox_init_point
    if (!initPoint) {
      return json({ error: 'Mercado Pago no devolvió el link de pago.' }, { status: 500 })
    }

    // Guardar la preferencia en la orden para trazabilidad
    await supabase.from('ordenes').update({ mp_preference_id: String(mpData.id) }).eq('id', ordenId)

    return json({
      preference_id: mpData.id,
      init_point: initPoint,
    })
  } catch (err) {
    console.error('create-preference error:', err)
    return json({ error: 'Error inesperado al crear la preferencia de pago.' }, { status: 500 })
  }
})