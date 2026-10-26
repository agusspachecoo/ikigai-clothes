import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ESTADOS_CERRADOS = new Set(['pagado', 'enviado', 'entregado', 'cancelado'])
const DIAS_MAX = 30

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
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido.' }, { status: 405 })
  }

  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Cuerpo JSON inválido.' }, { status: 400 })
    }

    const { ordenId, path } = (body ?? {}) as { ordenId?: unknown; path?: unknown }

    if (typeof ordenId !== 'string' || !UUID_RE.test(ordenId)) {
      return json({ error: 'ordenId inválido.' }, { status: 400 })
    }

    if (
      typeof path !== 'string' ||
      path.length > 300 ||
      path.includes('..') ||
      !path.startsWith(`comprobantes/${ordenId}-`)
    ) {
      return json({ error: 'Comprobante inválido.' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: orden, error: errOrden } = await supabase
      .from('ordenes')
      .select('id, metodo_pago, estado, estado_pago, created_at')
      .eq('id', ordenId)
      .maybeSingle()

    if (errOrden) {
      console.error('registrar-comprobante: error leyendo orden:', errOrden.message)
      return json({ error: 'No se pudo leer el pedido.' }, { status: 500 })
    }

    if (!orden) {
      return json({ error: 'Pedido no encontrado.' }, { status: 404 })
    }

    if (orden.metodo_pago !== 'transferencia') {
      return json({ error: 'El pedido no es por transferencia.' }, { status: 409 })
    }

    if (orden.estado_pago === 'pagado' || ESTADOS_CERRADOS.has(String(orden.estado))) {
      return json({ error: 'El pedido ya no admite comprobantes.' }, { status: 409 })
    }

    const creadaEn = Date.parse(String(orden.created_at ?? ''))
    if (!Number.isFinite(creadaEn) || Date.now() - creadaEn > DIAS_MAX * 24 * 60 * 60 * 1000) {
      return json({ error: 'El pedido es demasiado antiguo.' }, { status: 410 })
    }

    const { error: errUpdate } = await supabase
      .from('ordenes')
      .update({ comprobante_url: path, estado: 'pendiente_verificacion' })
      .eq('id', ordenId)

    if (errUpdate) {
      console.error('registrar-comprobante: error actualizando orden:', errUpdate.message)
      return json({ error: 'No se pudo vincular el comprobante.' }, { status: 500 })
    }

    return json({ ok: true })
  } catch (err) {
    console.error('registrar-comprobante:', err)
    return json({ error: 'Error inesperado.' }, { status: 500 })
  }
})
