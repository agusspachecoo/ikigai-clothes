// ============================================================
// IKIGAI CLOTHES - acceso-invitado
//
// Acciones:
//   consultar -> devuelve un pedido con token de invitado o JWT del dueño.
//   reclamar  -> vincula la orden al usuario autenticado si su email confirmado
//                coincide con el email del pedido. No requiere token.
//
// El token nunca se guarda en claro en la base: se compara el SHA-256.
// ============================================================

import { getSupabaseAdmin, getUsuario, puedeAccederOrden } from '../_shared/auth.ts'
import type { PromocionAplicada } from '../_shared/promociones.ts'
import { corsHeaders, json } from '../_shared/cors.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface OrdenFila {
  id: string
  cliente_id: string | null
  cliente_email: string
  guest_token_hash: string | null
  guest_token_expira_at: string | null
  cliente_nombre: string
  metodo_pago: 'mercadopago' | 'transferencia'
  monto_total: number
  costo_envio: number
  estado: string
  estado_pago: string
  cupon_codigo: string | null
  descuento_cupon: number
  descuento_promociones: number
  promociones_aplicadas: PromocionAplicada[]
  descuento_outfit: number
  envio_detalle: Record<string, unknown> | null
  created_at: string
}

interface ItemFila {
  producto_id: string
  talle: string
  cantidad: number
  precio_unitario: number
  productos: { nombre: string; imagenes: string[] | null } | null
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

function numero(valor: unknown): number {
  const n = Number(valor)
  return Number.isFinite(n) ? n : 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, { status: 405 })

  try {
    let body: { action?: unknown; ordenId?: unknown; ordenToken?: unknown }
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Cuerpo JSON inválido.' }, { status: 400 })
    }

    const action = texto(body.action).toLowerCase()
    const ordenId = texto(body.ordenId)
    const ordenToken = texto(body.ordenToken)
    if (!UUID_RE.test(ordenId)) {
      return json({ error: 'ordenId inválido.' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const usuario = await getUsuario(req, supabase)

    const { data: orden, error: errOrden } = await supabase
      .from('ordenes')
      .select('id, cliente_id, cliente_email, guest_token_hash, guest_token_expira_at, cliente_nombre, metodo_pago, monto_total, costo_envio, estado, estado_pago, cupon_codigo, descuento_cupon, descuento_promociones, promociones_aplicadas, descuento_outfit, envio_detalle, created_at')
      .eq('id', ordenId)
      .maybeSingle<OrdenFila>()

    if (errOrden) {
      console.error('acceso-invitado: error leyendo orden:', errOrden.message)
      return json({ error: 'No se pudo leer el pedido.' }, { status: 500 })
    }

    if (!orden) {
      return json({ error: 'Pedido no encontrado.' }, { status: 404 })
    }

    if (action === 'reclamar') {
      if (!usuario) {
        return json({ error: 'Necesitás iniciar sesión para guardar el pedido.' }, { status: 401 })
      }
      if (!usuario.email_confirmed_at || !usuario.email) {
        return json({ error: 'Confirmá tu email antes de guardar el pedido.' }, { status: 403 })
      }
      if (String(usuario.email).toLowerCase() !== orden.cliente_email.toLowerCase()) {
        return json({ error: 'Pedido no encontrado.' }, { status: 404 })
      }
      if (orden.cliente_id && orden.cliente_id !== usuario.id) {
        return json({ error: 'Pedido no encontrado.' }, { status: 404 })
      }

      const { error } = await supabase
        .from('ordenes')
        .update({
          cliente_id: usuario.id,
          // Una vez reclamada, el link con token deja de ser necesario.
          guest_token_hash: null,
          guest_token_expira_at: null,
        })
        .eq('id', ordenId)
        .is('cliente_id', null)

      if (error) {
        // Si otro proceso la reclamó entre la lectura y el UPDATE, el filtro
        // `.is('cliente_id', null)` afecta 0 filas y no devuelve error.
        console.error('acceso-invitado: error reclamando orden:', error.message)
        return json({ error: 'No se pudo guardar el pedido en tu cuenta.' }, { status: 500 })
      }

      return json({ ok: true })
    }

    if (action !== 'consultar') {
      return json({ error: 'Acción inválida.' }, { status: 400 })
    }

    if (!(await puedeAccederOrden(orden, usuario, ordenToken))) {
      return json({ error: 'Pedido no encontrado.' }, { status: 404 })
    }

    const { data: filasItems, error: errItems } = await supabase
      .from('orden_items')
      .select('producto_id, talle, cantidad, precio_unitario, productos(nombre, imagenes)')
      .eq('orden_id', ordenId)

    if (errItems) {
      console.error('acceso-invitado: error leyendo items:', errItems.message)
      return json({ error: 'No se pudo leer el pedido.' }, { status: 500 })
    }

    const items = ((filasItems ?? []) as unknown as ItemFila[]).map((i) => ({
      producto_id: i.producto_id,
      nombre: i.productos?.nombre ?? 'Producto',
      imagen: i.productos?.imagenes?.[0] ?? '',
      talle: i.talle,
      cantidad: Number(i.cantidad),
      precio_unitario: Number(i.precio_unitario),
    }))

    const subtotal = items.reduce((n, i) => n + i.precio_unitario * i.cantidad, 0)
    const envio = orden.envio_detalle ?? {}
    const retiro = envio.metodo === 'retiro'
    const carrier = texto(envio.carrier)
    const tiempo = texto(envio.tiempo)
    const descuentoTransferencia = Math.max(
      0,
      subtotal +
        Number(orden.costo_envio ?? 0) -
        Number(orden.monto_total ?? 0) -
        Number(orden.descuento_cupon ?? 0) -
        Number(orden.descuento_promociones ?? 0) -
        Number(orden.descuento_outfit ?? 0),
    )

    return json({
      orden: {
        id: orden.id,
        metodo: orden.metodo_pago,
        items,
        subtotal,
        descuentoTransferencia: Math.round(descuentoTransferencia * 100) / 100,
        descuentoCupon: numero(orden.descuento_cupon),
        descuentoPromociones: numero(orden.descuento_promociones),
        promocionesAplicadas: Array.isArray(orden.promociones_aplicadas)
          ? orden.promociones_aplicadas
          : [],
        descuentoOutfit: numero(orden.descuento_outfit),
        costoEnvio: numero(orden.costo_envio),
        envioGratis: !retiro && numero(orden.costo_envio) === 0,
        total: numero(orden.monto_total),
        cuponCodigo: orden.cupon_codigo,
        envioLabel: retiro
          ? 'Retiro en showroom'
          : [carrier, tiempo].filter(Boolean).join(' · ') || 'Envío a domicilio',
        retiro,
        nombre: orden.cliente_nombre,
        email: orden.cliente_email,
        estado: orden.estado,
        estadoPago: orden.estado_pago,
        createdAt: orden.created_at,
      },
    })
  } catch (error) {
    console.error('acceso-invitado error:', error)
    return json({ error: 'Error inesperado.' }, { status: 500 })
  }
})
