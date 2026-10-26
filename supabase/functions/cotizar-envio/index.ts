// ============================================================
// IKIGAI CLOTHES - cotizar-envio
//
// Cotiza el envío en el servidor y firma cada opción con HMAC. El cliente
// ya no puede cambiar el costo antes de crear la orden.
//
// Estrategia:
//   1. CP de Oberá -> envío gratis local.
//   2. MiCorreo (si está configurado) -> tarifas reales.
//   3. Fallback: tarifario local (mismo que usaba el navegador).
//
// Secrets requeridos:
//   SHIPPING_QUOTE_SECRET  -> obligatorio, mínimo 32 caracteres.
//   CORREO_ARGENTINO_*     -> opcionales; si faltan, se usa el fallback local.
// ============================================================

import { getSupabaseAdmin } from '../_shared/auth.ts'
import { corsHeaders, json } from '../_shared/cors.ts'
import {
  cotizarConRates,
  cotizarLocal,
  firmarCotizacion,
  hashCarrito,
  normalizarCp,
  ORIGEN_CP,
  QUOTE_TTL_MS,
  type ItemCarrito,
  type OpcionEnvio,
  type QuotePayload,
  type ResultadoCotizacion,
} from '../_shared/envio.ts'

const MAX_ITEMS = 50
const MAX_BULTOS = 50

interface Body {
  codigo_postal?: unknown
  items?: unknown
  subtotal?: unknown
}

function leerItems(valor: unknown): ItemCarrito[] {
  if (!Array.isArray(valor)) return []
  return valor.slice(0, MAX_ITEMS).flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const i = item as Record<string, unknown>
    const producto_id = String(i.producto_id ?? '').trim()
    const cantidad = Math.max(1, Math.floor(Number(i.cantidad) || 0))
    if (!producto_id || cantidad < 1) return []
    return [{ producto_id, talle: String(i.talle ?? '').trim(), cantidad }]
  })
}

async function configEnvioGratis(admin: ReturnType<typeof getSupabaseAdmin>) {
  const { data } = await admin
    .from('config_tienda')
    .select('clave,valor')
    .in('clave', ['envio_gratis_activo', 'umbral_envio_gratis'])

  const mapa = new Map((data ?? []).map((c) => [c.clave, c.valor]))
  return {
    activo: mapa.get('envio_gratis_activo') === 'true',
    umbral: Number(mapa.get('umbral_envio_gratis') ?? 0),
  }
}

async function cotizarRemoto(cp: string, bultos: number): Promise<ResultadoCotizacion | null> {
  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anon) return null

  try {
    const res = await fetch(`${url}/functions/v1/micorreo-envio`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${anon}`,
        apikey: anon,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'rates',
        postalCodeDestination: cp,
        dimensions: {
          weight: Math.min(25_000, Math.max(1, bultos * 300)),
          height: 5,
          width: 20,
          length: 30,
        },
      }),
    })

    if (!res.ok) return null
    const data = (await res.json()) as { rates?: unknown[] }
    if (!Array.isArray(data.rates) || data.rates.length === 0) return null

    return cotizarConRates(cp, bultos, data.rates as never[])
  } catch (error) {
    console.warn('cotizar-envio: fallback local por error de MiCorreo:', error)
    return null
  }
}

async function firmarOpciones(
  resultado: ResultadoCotizacion,
  cp: string,
  itemsHash: string,
  secret: string,
): Promise<OpcionEnvio[]> {
  return Promise.all(
    resultado.opciones.map(async (opcion) => {
      const payload: QuotePayload = {
        v: 1,
        cp,
        items_hash: itemsHash,
        costo: opcion.costo,
        carrier: opcion.carrier.name,
        carrier_id: opcion.carrier.id,
        servicio: opcion.id_servicio ?? '',
        service_type: opcion.service_type.code ?? '',
        logistic_type: opcion.logistic_type,
        tiempo: opcion.tiempo_estimado,
        mock: resultado.mock,
        exp: Date.now() + QUOTE_TTL_MS,
      }
      return { ...opcion, quote_token: await firmarCotizacion(payload, secret) }
    }),
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, { status: 405 })

  const secret = Deno.env.get('SHIPPING_QUOTE_SECRET') ?? ''
  if (secret.length < 32) {
    console.error('cotizar-envio: falta SHIPPING_QUOTE_SECRET (mínimo 32 caracteres).')
    return json({ error: 'La cotización de envío no está configurada.' }, { status: 503 })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const cp = normalizarCp(body.codigo_postal)
  const items = leerItems(body.items)
  const bultos = Math.min(
    MAX_BULTOS,
    items.reduce((total, item) => total + item.cantidad, 0),
  )

  if (cp.length < 4) {
    return json({ error: 'Ingresá un código postal válido.' }, { status: 400 })
  }
  if (items.length === 0 || bultos === 0) {
    return json({ error: 'El carrito está vacío.' }, { status: 400 })
  }

  const itemsHash = await hashCarrito(items)
  let resultado: ResultadoCotizacion | null = null

  if (cp !== ORIGEN_CP) {
    resultado = await cotizarRemoto(cp, bultos)
  }
  if (!resultado) resultado = cotizarLocal(cp, bultos)

  if (resultado.opciones.length === 0) {
    return json(
      { error: resultado.error ?? 'No hay envíos disponibles para ese código postal.' },
      { status: 422 },
    )
  }

  const admin = getSupabaseAdmin()
  const envioGratis = await configEnvioGratis(admin)
  const subtotal = Math.max(0, Number(body.subtotal) || 0)
  // No alcanza con que una opción remota venga en $0 para regalar todas las
  // demás: eso convertiría un "retiro en sucursal gratis" del carrier en envío
  // a domicilio gratis. El beneficio se aplica por CP local o por umbral.
  const aplicaGratis =
    cp === ORIGEN_CP ||
    (envioGratis.activo && envioGratis.umbral > 0 && subtotal >= envioGratis.umbral)

  if (aplicaGratis) {
    resultado = {
      ...resultado,
      opciones: resultado.opciones.map((o, i) => ({
        ...o,
        costo: 0,
        tags: i === 0 ? ['cheapest', 'fastest'] : o.tags,
      })),
    }
  }

  const opciones = await firmarOpciones(resultado, cp, itemsHash, secret)
  return json({ ...resultado, opciones })
})
