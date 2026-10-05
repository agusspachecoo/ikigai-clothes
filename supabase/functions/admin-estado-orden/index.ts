// ============================================================
// IKIGAI CLOTHES - admin-estado-orden
// Cambia el estado de un pedido desde el panel de administración.
//
// Por qué existe: descontar_stock() es SECURITY DEFINER y desde la
// migración 019 ya no puede invocarla el navegador (anon /
// authenticated tienen el EXECUTE revocado). Solo service_role puede.
//
// Esta función es el único camino para confirmar una transferencia
// bancaria a mano, así que valida el rol del admin ella misma y no
// confía en que el panel ya lo hizo: el gate del frontend
// (AdminLayout / useEsAdmin) es solo UX y se puede saltear con DevTools.
//
// Uso:
//   POST /functions/v1/admin-estado-orden
//   Authorization: Bearer <JWT del admin>
//   { "orden_id": "<uuid>", "estado": "pagado" }
//
// Requiere: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (ya presentes en
// el entorno de las Edge Functions).
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

// Mismos estados que ESTADOS_ORDEN en src/lib/adminApi.ts y el CHECK
// ordenes_estado_check de la migración 011.
const ESTADOS = ['pendiente', 'pendiente_verificacion', 'pagado', 'enviado', 'entregado', 'cancelado'] as const
type Estado = (typeof ESTADOS)[number]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
    // ------------------------------------------------------------
    // 1. Autenticar: el JWT del admin tiene que ser válido
    // ------------------------------------------------------------
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

    if (!token) {
      return json({ error: 'Falta el token de sesión.' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()

    // getUser valida el JWT contra el servidor de Auth (firma, expiración,
    // emissor). No alcanza con decodificarlo del lado del cliente.
    const { data: userData, error: errUser } = await supabase.auth.getUser(token)

    if (errUser || !userData?.user) {
      return json({ error: 'Sesión inválida o vencida.' }, { status: 401 })
    }

    const usuario = userData.user

    // ------------------------------------------------------------
    // 2. Autorizar: es_admin. service_role ignora RLS, así que esta
    //    comprobación es la única barrera real.
    // ------------------------------------------------------------
    const { data: perfil, error: errPerfil } = await supabase
      .from('perfiles')
      .select('es_admin')
      .eq('id', usuario.id)
      .maybeSingle()

    if (errPerfil) {
      console.error('admin-estado-orden: error leyendo perfil:', errPerfil.message)
      return json({ error: 'No se pudo verificar el permiso.' }, { status: 500 })
    }

    if (perfil?.es_admin !== true) {
      return json({ error: 'Tu cuenta no tiene acceso al panel.' }, { status: 403 })
    }

    // ------------------------------------------------------------
    // 3. Validar el payload
    // ------------------------------------------------------------
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Cuerpo JSON inválido.' }, { status: 400 })
    }

    const { orden_id, estado } = (body ?? {}) as { orden_id?: unknown; estado?: unknown }

    if (typeof orden_id !== 'string' || !UUID_RE.test(orden_id)) {
      return json({ error: 'orden_id inválido.' }, { status: 400 })
    }

    if (typeof estado !== 'string' || !ESTADOS.includes(estado as Estado)) {
      return json({ error: 'Estado inválido.' }, { status: 400 })
    }

    const nuevoEstado = estado as Estado

    // ------------------------------------------------------------
    // 4. Verificar que el pedido existe
    // ------------------------------------------------------------
    const { data: orden, error: errOrden } = await supabase
      .from('ordenes')
      .select('id, estado, estado_pago, metodo_pago')
      .eq('id', orden_id)
      .maybeSingle()

    if (errOrden) {
      console.error('admin-estado-orden: error leyendo orden:', errOrden.message)
      return json({ error: 'No se pudo leer el pedido.' }, { status: 500 })
    }

    if (!orden) {
      return json({ error: 'El pedido no existe.' }, { status: 404 })
    }

    // ------------------------------------------------------------
    // 5. Aplicar el cambio de estado
    // ------------------------------------------------------------
    // El orden importa: descontar_stock() exige estado_pago = 'pagado'
    // (precondición agregada en la migración 019), así que primero se
    // confirma el pago y después se descuenta el stock.
    const update: Record<string, unknown> = { estado: nuevoEstado }

    if (nuevoEstado === 'pagado') {
      update.estado_pago = 'pagado'
    }

    const { error: errUpdate } = await supabase
      .from('ordenes')
      .update(update)
      .eq('id', orden_id)

    if (errUpdate) {
      console.error('admin-estado-orden: error actualizando orden:', errUpdate.message)
      return json({ error: 'No se pudo actualizar el pedido.' }, { status: 500 })
    }

    // ------------------------------------------------------------
    // 6. Descontar stock (solo al confirmar el pago)
    // ------------------------------------------------------------
    // El webhook de Mercado Pago ya hizo esto para los pagos con MP.
    // descontar_stock es idempotente por pedido (stock_descontado), así
    // que llamarlo de nuevo sobre una orden de MP no descuenta dos veces.
    let stockDescontado = false

    if (nuevoEstado === 'pagado') {
      const { error: errStock } = await supabase.rpc('descontar_stock', { p_orden_id: orden_id })

      if (errStock) {
        console.error('admin-estado-orden: error descontando stock:', errStock.message)
        // El estado ya quedó en 'pagado'. Se reporta para que el admin
        // reintente, en vez de revertir silenciosamente.
        return json(
          {
            error: 'El estado se actualizó pero no se pudo descontar el stock. Reintentá en unos segundos.',
            estado_actualizado: true,
          },
          { status: 500 },
        )
      }

      stockDescontado = true

      // Consumir un uso del cupón, igual que hace el webhook de MP.
      // usar_cupon también es service_role only (016_cupones.sql:78-80).
      const { data: conCupon } = await supabase
        .from('ordenes')
        .select('cupon_codigo')
        .eq('id', orden_id)
        .maybeSingle()

      if (conCupon?.cupon_codigo) {
        const { error: errCupon } = await supabase.rpc('usar_cupon', {
          p_codigo: conCupon.cupon_codigo,
          p_orden_id: orden_id,
        })
        if (errCupon) {
          console.error('admin-estado-orden: error usando cupón:', errCupon.message)
        }
      }
    }

    return json({
      ok: true,
      id: orden_id,
      estado: nuevoEstado,
      stock_descontado: stockDescontado,
      ya_pagada: orden.estado_pago === 'pagado',
    })
  } catch (err) {
    // El detalle va al log del servidor; la respuesta al cliente es genérica
    // para no filtrar stack traces ni mensajes internos de Postgres.
    console.error('admin-estado-orden error:', err)
    return json({ error: 'Error inesperado al actualizar el pedido.' }, { status: 500 })
  }
})