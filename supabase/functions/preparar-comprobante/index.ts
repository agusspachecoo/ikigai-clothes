// ============================================================
// IKIGAI CLOTHES - preparar-comprobante
//
// Genera una signed upload URL para que el cliente suba el comprobante
// directamente a Storage sin permiso de INSERT anónimo.
//
// Autorización:
//   - dueño de la orden (JWT), o
//   - invitado con el token de la orden.
//
// La policy anónima de Storage de 027 se elimina en 028.
// ============================================================

import { getSupabaseAdmin, getUsuario, puedeAccederOrden } from '../_shared/auth.ts'
import { corsHeaders, json } from '../_shared/cors.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const BUCKET = 'comprobantes'
const DIAS_MAX = 30
const ESTADOS_CERRADOS = new Set(['pagado', 'enviado', 'entregado', 'cancelado'])

function extension(nombre: unknown): string {
  return String(nombre ?? '')
    .split('.')
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 5) || 'jpg'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, { status: 405 })

  try {
    let body: {
      ordenId?: unknown
      ordenToken?: unknown
      nombreArchivo?: unknown
    }
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Cuerpo JSON inválido.' }, { status: 400 })
    }

    const ordenId = String(body.ordenId ?? '').trim()
    const ordenToken = String(body.ordenToken ?? '').trim()
    if (!UUID_RE.test(ordenId)) {
      return json({ error: 'ordenId inválido.' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const usuario = await getUsuario(req, supabase)

    const { data: orden, error: errOrden } = await supabase
      .from('ordenes')
      .select('id, cliente_id, cliente_email, guest_token_hash, guest_token_expira_at, metodo_pago, estado, estado_pago, created_at')
      .eq('id', ordenId)
      .maybeSingle()

    if (errOrden) {
      console.error('preparar-comprobante: error leyendo orden:', errOrden.message)
      return json({ error: 'No se pudo leer el pedido.' }, { status: 500 })
    }

    if (!orden || !(await puedeAccederOrden(orden, usuario, ordenToken))) {
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

    // `createSignedUploadUrl` recibe el path RELATIVO al bucket. El path que se
    // guarda en `ordenes.comprobante_url` sí lleva el prefijo del bucket, que es
    // lo que espera después `comprobanteFirmado()` y la validación de
    // `registrar-comprobante`.
    const pathRelativo = `${ordenId}-${Date.now()}.${extension(body.nombreArchivo)}`
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(pathRelativo, { upsert: false })

    if (error || !data) {
      console.error('preparar-comprobante: error creando signed upload:', error?.message)
      return json({ error: 'No se pudo preparar la subida del comprobante.' }, { status: 500 })
    }

    return json({
      // Path relativo para `uploadToSignedUrl`.
      path: data.path ?? pathRelativo,
      token: data.token,
      signedUrl: data.signedUrl,
      // Path que se guarda en la orden (con bucket, como en 027).
      comprobanteUrl: `${BUCKET}/${data.path ?? pathRelativo}`,
    })
  } catch (error) {
    console.error('preparar-comprobante error:', error)
    return json({ error: 'Error inesperado.' }, { status: 500 })
  }
})
