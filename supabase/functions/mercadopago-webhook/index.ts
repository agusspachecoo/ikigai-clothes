// ============================================================
// IKIGAI CLOTHES - mercadopago-webhook (IPN / Notificaciones)
//
// Mercado Pago envía un POST cuando hay un cambio en un pago.
// Este handler consulta el detalle real del pago en la API de
// Mercado Pago (nunca confía en el body del webhook) y actualiza
// el estado de la orden en Supabase.
//
// Notificación configurada: <SUPABASE_URL>/functions/v1/mercadopago-webhook
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

function getSupabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const payload = await req.json()

    // Estructura típica: { type: "payment", data: { id: 12345678 }, ... }
    const paymentId = payload?.data?.id ?? payload?.id
    if (!paymentId) {
      return json({ ok: false, error: 'Sin payment_id en el webhook.' }, { status: 400 })
    }

    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
    if (!accessToken) {
      return json({ ok: false, error: 'MERCADOPAGO_ACCESS_TOKEN no configurado.' }, { status: 500 })
    }

    // Consultar el estado real del pago en Mercado Pago
    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${String(paymentId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )

    if (!mpRes.ok) {
      console.error('MP payments lookup error:', mpRes.status, await mpRes.text())
      return json({ ok: false, status: mpRes.status }, { status: mpRes.status })
    }

    const payment = await mpRes.json()
    const ordenId = payment?.external_reference
    if (!ordenId) {
      return json({ ok: true }) // pago sin orden vinculada: ignorar
    }

    const supabase = getSupabaseAdmin()

    const { data: orden } = await supabase
      .from('ordenes')
      .select('monto_total, estado_pago')
      .eq('id', ordenId)
      .maybeSingle()

    if (!orden) {
      return json({ ok: true }) // orden inexistente: ignorar
    }

    // Doble verificación del monto pagado vs el total del pedido
    const montoPagado = Number(payment?.transaction_amount)
    if (Number.isFinite(montoPagado) && Math.round(montoPagado) !== Math.round(Number(orden.monto_total))) {
      return json({ ok: false, error: 'El monto pagado no coincide con el pedido.' }, { status: 409 })
    }

    const estadoPago = payment?.status
    const updateData: Record<string, unknown> = {
      mp_payment_id: String(paymentId),
      mp_pago_detalle: payment,
      updated_at: new Date().toISOString(),
    }

    if (estadoPago === 'approved') {
      updateData.estado_pago = 'pagado'
      updateData.estado = 'pagado'
    } else if (estadoPago === 'rejected' || estadoPago === 'cancelled') {
      updateData.estado_pago = 'fallido'
    } else {
      updateData.estado_pago = 'pendiente'
    }

    // Evitar actualizaciones innecesarias si ya está pagado
    if (orden.estado_pago !== 'pagado' || estadoPago === 'approved') {
      const { error } = await supabase.from('ordenes').update(updateData).eq('id', ordenId)
      if (error) {
        console.error('Supabase update error:', error)
        return json({ ok: false, error: error.message }, { status: 500 })
      }

      // Pago aprobado: descontar stock de las prendas (idempotente, ver migración 005)
      if (estadoPago === 'approved') {
        const { error: errorStock } = await supabase.rpc('descontar_stock', {
          p_orden_id: ordenId,
        })
        if (errorStock) {
          console.error('descontar_stock error:', errorStock)
          return json({ ok: false, error: errorStock.message }, { status: 500 })
        }
      }
    }

    return json({ ok: true, status: estadoPago })
  } catch (err) {
    console.error('mercadopago-webhook error:', err)
    return json({ ok: false, error: 'Error inesperado en el webhook.' }, { status: 500 })
  }
})