// ============================================================
// IKIGAI CLOTHES - create-preference
// Crear la preferencia de pago de Mercado Pago para un pedido.
//
// Requiere el secret: MERCADOPAGO_ACCESS_TOKEN
// (Supabase Dashboard -> Edge Functions -> Secrets, o `supabase secrets set`).
//
// ============================================================
// Reglas de seguridad (no negociable):
//
// 1. El navegador solo manda `ordenId` (y el token invitado si no hay sesión).
//    Los productos y precios salen de `orden_items`, no del body.
// 2. Se valida que el pedido exista y pertenezca al usuario o al token.
// 3. Se rechazan pedidos ya pagados, cancelados o que no sean de Mercado Pago.
// 4. Se releen los productos desde `productos` y se recalcula el precio real.
// 5. Se valida que cada producto exista, esté activo, que el talle exista en
//    `variaciones_stock` y que haya stock disponible.
// 6. El total y el envío se comparan contra lo que guardó `crear-orden`.
//
// Con esto, mandar precios o ítems arbitrarios en el body ya no alcanza para
// pagar menos de lo que corresponde.
// ============================================================

import { corsHeaders, json } from '../_shared/cors.ts'
import { getSupabaseAdmin, getUsuario, puedeAccederOrden } from '../_shared/auth.ts'
import { validarCupon, type Cupon } from '../_shared/cupones.ts'
import { precioUnitarioReal, round2, type ProductoPrecio } from '../_shared/precios.ts'
import { calcularDescuentoOutfit, type OutfitComposicion } from '../_shared/outfits.ts'

interface ItemInput {
  producto_id: string
  nombre: string
  talle?: string
  cantidad: number
  /** Viene del cliente pero NO se usa para cobrar: solo para comparar. */
  precio_unitario: number
}

interface ProductoConTalles extends ProductoPrecio {
  variaciones_stock: { talle: string; stock_disponible: number }[]
}

const hostLocales = ['localhost', '127.0.0.1', '0.0.0.0']

function esUrlPublica(url: string) {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

// La app usa BrowserRouter, así que las URLs de retorno van como rutas limpias
// (`/checkout/success`), sin fragmento hash.
const STORE_URL_FALLBACK = 'https://ikigai-clothes.vercel.app'

function obtenerBackUrls(back: { success?: string; failure?: string; pending?: string } | undefined) {
  // STORE_URL es la variable del backend. Si no está, caemos al dominio de
  // producción: antes, un localhost sin configurar mandaba al cliente a pagar y
  // lo hacía volver a 127.0.0.1, dejando el pedido sin confirmar.
  const store = (Deno.env.get('STORE_URL') ?? STORE_URL_FALLBACK).replace(/\/$/, '')
  const ruta = (sufijo: string) => `${store}/checkout/${sufijo}`

  if (store && esUrlPublica(store)) {
    return {
      success: ruta('success'),
      failure: ruta('failure'),
      pending: ruta('pending'),
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
    const { ordenId, ordenToken } = body

    if (!ordenId) {
      return json({ error: 'Falta el ID del pedido.' }, { status: 400 })
    }

    const backUrls = obtenerBackUrls(undefined)
    if (!backUrls) {
      return json(
        {
          error:
            'back_urls inválidas. Configurá la secret STORE_URL con la URL de producción en Vercel (ej: https://ikigai-clothes.vercel.app).',
        },
        { status: 400 },
      )
    }

    const supabase = getSupabaseAdmin()
    const usuario = await getUsuario(req, supabase)

    const { data: orden } = await supabase
      .from('ordenes')
      .select('id, cliente_id, cliente_email, guest_token_hash, guest_token_expira_at, monto_total, costo_envio, metodo_pago, estado, estado_pago, cliente_nombre, cliente_telefono, cliente_dni, codigo_postal, envio_detalle, cupon_codigo, descuento_cupon, descuento_outfit')
      .eq('id', ordenId)
      .maybeSingle()

    // 404 también cuando no tiene permiso: no se filtra si el pedido existe.
    if (!orden) {
      return json({ error: 'El pedido no existe.' }, { status: 404 })
    }

    const autorizado = await puedeAccederOrden(orden, usuario, String(ordenToken ?? '').trim())
    if (!autorizado) {
      return json({ error: 'El pedido no existe.' }, { status: 404 })
    }

    if (orden.estado_pago === 'pagado') {
      return json({ error: 'Este pedido ya está pagado.', ya_pagada: true }, { status: 409 })
    }
    if (orden.estado === 'cancelado') {
      return json({ error: 'Este pedido fue cancelado.' }, { status: 409 })
    }

    // Solo Mercado Pago genera preferencias acá. Si la orden es por
    // transferencia, no se debe abrir el checkout de MP.
    if (orden.metodo_pago && orden.metodo_pago !== 'mercadopago') {
      return json(
        { error: 'Esta orden no se paga por Mercado Pago.' },
        { status: 409 },
      )
    }

    // Los ítems salen de `orden_items`, no del navegador. El cliente ya no
    // puede elegir qué productos ni qué precios se cobran en la preferencia.
    const { data: filasItems, error: errorItemsOrden } = await supabase
      .from('orden_items')
      .select('producto_id, talle, cantidad, precio_unitario')
      .eq('orden_id', ordenId)

    if (errorItemsOrden) {
      console.error('Error leyendo orden_items:', errorItemsOrden)
      return json({ error: 'No pudimos leer los productos del pedido.' }, { status: 500 })
    }

    if (!filasItems || filasItems.length === 0) {
      return json({ error: 'El pedido no tiene productos.' }, { status: 409 })
    }

    const costoEnvioOrden = Number(orden.costo_envio ?? 0) || 0
    const carrierEnvioOrden =
      (orden.envio_detalle as { carrier?: string | null } | null)?.carrier ?? null

    const itemsInput: ItemInput[] = filasItems.map((i) => ({
      producto_id: String(i.producto_id),
      nombre: '',
      talle: String(i.talle),
      cantidad: Number(i.cantidad),
      precio_unitario: Number(i.precio_unitario),
    }))

    // ---------------------------------------------------------------
    // PASO 1: releer los precios REALES desde la base de datos.
    // ---------------------------------------------------------------
    const ids = itemsInput.map((i) => String(i.producto_id ?? '').trim())

    if (ids.some((id) => !id)) {
      return json({ error: 'Hay ítems sin producto_id.' }, { status: 400 })
    }

    const idsUnicos = [...new Set(ids)]

    const { data: productos, error: errorProductos } = await supabase
      .from('productos')
      .select('id, nombre, precio, discount_percent, activo, variaciones_stock(talle, stock_disponible)')
      .in('id', idsUnicos)

    if (errorProductos) {
      console.error('Error leyendo productos:', errorProductos)
      return json({ error: 'No se pudieron verificar los productos.' }, { status: 500 })
    }

    const catalogo = new Map<string, ProductoConTalles>(
      ((productos ?? []) as ProductoConTalles[]).map((p) => [String(p.id), p]),
    )

    const faltantes = idsUnicos.filter((id) => !catalogo.has(id))
    if (faltantes.length > 0) {
      return json(
        { error: `Producto inexistente: ${faltantes.join(', ')}.` },
        { status: 409 },
      )
    }

    const inactivos = idsUnicos.filter((id) => catalogo.get(id)?.activo === false)
    if (inactivos.length > 0) {
      return json(
        { error: 'Uno o más productos del carrito ya no están disponibles.' },
        { status: 409 },
      )
    }

    // ---------------------------------------------------------------
    // PASO 2: reconstruir cada ítem con el precio del catálogo.
    // ---------------------------------------------------------------
    type ItemResuelto = {
      producto_id: string
      nombre: string
      talle: string
      cantidad: number
      precio_unitario: number
    }

    const itemsResueltos: ItemResuelto[] = []

    for (const item of itemsInput) {
      const producto = catalogo.get(String(item.producto_id ?? '').trim())!

      const cantidad = Math.floor(Number(item.cantidad))
      if (!Number.isFinite(cantidad) || cantidad < 1 || cantidad > 99) {
        return json({ error: 'Cantidad inválida en el carrito.' }, { status: 400 })
      }

      const talle = String(item.talle ?? '').trim()
      if (!talle) {
        return json({ error: `Falta elegir el talle de "${producto.nombre}".` }, { status: 400 })
      }

      const variaciones = producto.variaciones_stock ?? []
      const variacion = variaciones.find((v) => String(v.talle) === talle)

      if (!variacion) {
        return json(
          { error: `El talle ${talle} no existe para "${producto.nombre}".` },
          { status: 409 },
        )
      }

      if (Number(variacion.stock_disponible) < cantidad) {
        return json(
          {
            error: `Stock insuficiente para "${producto.nombre}" talle ${talle}. Quedan ${variacion.stock_disponible}.`,
          },
          { status: 409 },
        )
      }

      itemsResueltos.push({
        producto_id: String(producto.id),
        nombre: String(producto.nombre),
        talle,
        cantidad,
        precio_unitario: precioUnitarioReal(producto),
      })
    }

    // ---------------------------------------------------------------
    // PASO 3: el subtotal es SIEMPRE el del catálogo, no el del cliente.
    // ---------------------------------------------------------------
    const subtotalReal = itemsResueltos.reduce(
      (n, i) => n + i.precio_unitario * i.cantidad,
      0,
    )
    // Autoritativo: el que `crear-orden` validó y guardó.
    const costoEnvioNum = costoEnvioOrden

    // Aviso en log si el cliente mandó precios distintos a los reales: sirve
    // para detectar si queda algún cliente viejo con el cálculo desactualizado.
    const montoCliente = itemsInput.reduce(
      (n, i) => n + Number(i.cantidad) * Number(i.precio_unitario),
      0,
    )
    if (Math.abs(montoCliente - subtotalReal) > 0.01) {
      console.warn(
        `Precio del cliente ignorado (orden ${ordenId}): enviado=${montoCliente} real=${subtotalReal}`,
      )
    }

    // El envío gratis solo puede venir del retiro en el local o del umbral de la
    // tienda: si el cliente pide envío gratis sin cumplir, se rechaza.
    //
    // Excepción: el envío gratis local de Oberá (CP 3360) y la opción de envío
    // gratuita local no están sujetos al mínimo de compra. El umbral de
    // $150.000 aplica únicamente a envíos nacionales por correo fuera de Oberá.
    if (costoEnvioNum <= 0 && carrierEnvioOrden) {
      const envioDetalle = (orden.envio_detalle as {
        codigo_postal?: string
        service_type?: string
      } | null) ?? null

      const cpOrden = String(envioDetalle?.codigo_postal ?? orden.codigo_postal ?? '')
        .replace(/\D/g, '')
      const tipoServicio = String(envioDetalle?.service_type ?? '').toUpperCase()

      const esEnvioLocalGratis = cpOrden === '3360' || tipoServicio === 'GRATIS'

      if (!esEnvioLocalGratis) {
        const { data: config } = await supabase
          .from('config_tienda')
          .select('clave, valor')
          .in('clave', ['envio_gratis_activo', 'umbral_envio_gratis'])

        const activo = config?.find((c) => c.clave === 'envio_gratis_activo')?.valor === 'true'
        const umbral = Number(config?.find((c) => c.clave === 'umbral_envio_gratis')?.valor ?? 0)

        // Mismo criterio que el checkout y `crear-orden`: el umbral se evalúa
        // sobre el subtotal ya descontado (cupón + outfit; MP no tiene
        // descuento por transferencia).
        const subtotalConDescuento = Math.max(
          0,
          subtotalReal -
            Number(orden.descuento_cupon ?? 0) -
            Number(orden.descuento_outfit ?? 0),
        )

        if (activo && umbral > 0 && subtotalConDescuento < umbral) {
          return json(
            { error: `El envío gratis se aplica a compras desde $${umbral.toLocaleString('es-AR')}.` },
            { status: 409 },
          )
        }
      }
    }

    // El cupón se recalcula acá: el descuento que envía el cliente no se confía
    let descuentoCupon = 0
    let etiquetaCupon = ''
    const codigoCupon = String(orden.cupon_codigo ?? '').trim().toUpperCase()

    if (codigoCupon) {
      const { data: cupon } = await supabase
        .from('cupones')
        .select('*')
        .eq('codigo', codigoCupon)
        .maybeSingle()

      const resultado = validarCupon((cupon ?? null) as Cupon | null, subtotalReal)
      if (!resultado.ok) {
        return json({ error: resultado.motivo ?? 'El cupón no es válido.' }, { status: 409 })
      }

      descuentoCupon = resultado.descuento
      etiquetaCupon = `Cupón ${codigoCupon}`
    }

    if (Math.abs(Number(orden.descuento_cupon ?? 0) - descuentoCupon) > 0.01) {
      return json({ error: 'El descuento del cupón no coincide con el pedido.' }, { status: 409 })
    }

    // Descuento por outfit completo: se recalcula contra `outfit_items` y se
    // valida contra lo que guardó `crear-orden`. Si no coincide (p. ej. un
    // outfit se desactivó entre crear la orden y pagar) se rechaza el pago en
    // vez de cobrar un importe distinto al que vio el cliente.
    const { data: filasOutfits, error: errorOutfits } = await supabase
      .from('outfits')
      .select('outfit_items(producto_id)')
      .eq('activo', true)

    if (errorOutfits) {
      console.error('Error leyendo outfits:', errorOutfits)
    }

    const outfits: OutfitComposicion[] = (filasOutfits ?? []).map((o) => ({
      producto_ids: (o.outfit_items ?? []).map(
        (i: { producto_id: string }) => String(i.producto_id),
      ),
    }))

    const descuentoOutfit = calcularDescuentoOutfit(itemsResueltos, outfits)

    if (Math.abs(Number(orden.descuento_outfit ?? 0) - descuentoOutfit) > 0.01) {
      return json(
        { error: 'El descuento de outfit cambió. Volvé al carrito e intentá de nuevo.' },
        { status: 409 },
      )
    }

    const totalEsperado = round2(
      subtotalReal + costoEnvioNum - descuentoCupon - descuentoOutfit,
    )
    const montoOrden = round2(Number(orden.monto_total) || 0)
    if (Math.abs(montoOrden - totalEsperado) > 0.01) {
      // Los precios del catálogo pudieron cambiar entre que se armó el carrito
      // y se intentó pagar. Se devuelve el importe real para que el front pueda
      // avisarle al cliente en vez de mostrar un error genérico.
      return json(
        {
          error: 'Los precios cambiaron. Revisá el carrito e intentá de nuevo.',
          monto_esperado: totalEsperado,
        },
        { status: 409 },
      )
    }

    // API oficial de Mercado Pago (Checkout Pro): crear preferencia
    const mpItems = itemsResueltos.map((i) => ({
      id: i.producto_id,
      title: `${i.nombre} - Talle ${i.talle}`,
      quantity: i.cantidad,
      unit_price: round2(i.precio_unitario),
      currency_id: 'ARS',
    }))
    if (costoEnvioNum > 0) {
      mpItems.push({
        id: 'envio',
        title: carrierEnvioOrden ? `Envío (${carrierEnvioOrden})` : 'Envío',
        quantity: 1,
        unit_price: costoEnvioNum,
        currency_id: 'ARS',
      })
    }

    // El descuento del cupón viaja como ítem negativo para que el total de la
    // preferencia sea exactamente el monto de la orden
    if (descuentoCupon > 0) {
      mpItems.push({
        id: 'cupon',
        title: etiquetaCupon,
        quantity: 1,
        unit_price: -descuentoCupon,
        currency_id: 'ARS',
      })
    }

    // El descuento por outfit también viaja como ítem negativo.
    if (descuentoOutfit > 0) {
      mpItems.push({
        id: 'outfit',
        title: 'Descuento outfit',
        quantity: 1,
        unit_price: -descuentoOutfit,
        currency_id: 'ARS',
      })
    }

    const mpBody = {
      statement_descriptor: 'IKIGAI CLOTHES',
      items: mpItems,
      payer: {
        name: orden.cliente_nombre,
        email: orden.cliente_email,
        phone: {
          area_code: '54',
          number: String(orden.cliente_telefono)
            .replace(/\D/g, '')
            .replace(/^54/, '')
            .slice(0, 15),
        },
        identification: {
          type: 'DNI',
          number: String(orden.cliente_dni).replace(/\D/g, ''),
        },
      },
      external_reference: String(ordenId),
      back_urls: backUrls,
      auto_return: 'approved',
      // El webhook se arma server-side: un cliente no puede desviar las
      // notificaciones a un dominio propio.
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
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