// ============================================================
// IKIGAI CLOTHES - create-preference
// Crear la preferencia de pago de Mercado Pago para un pedido.
//
// Requiere el secret: MERCADOPAGO_ACCESS_TOKEN
// (Supabase Dashboard -> Edge Functions -> Secrets, o `supabase secrets set`).
//
// ============================================================
// Sudá de seguridad (no negociable):
//
// 1. El precio_unitario que envía el cliente se IGNORA por completo. Se releen
//    los productos desde `productos` y se recalcula el precio real.
// 2. Se valida que cada producto exista y esté activo.
// 3. Se valida que cada talle exista en `variaciones_stock`.
// 4. Se valida el stock disponible.
// 5. Se valida que el total recalculado coincida con `ordenes.monto_total`.
//
// Con esto, mandar precio_unitario: 1 en el body ya no alcanza para comprar una
// remera de $50.000 por $1.
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
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
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

// La app usa BrowserRouter, así que las URLs de retorno van como rutas limpias
// (`/checkout/success`), sin fragmento hash.
const STORE_URL_FALLBACK = 'https://ikigai-store-omega.vercel.app'

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
    const { ordenId, items, cliente, urls, costo_envio = 0, carrier_envio, cupon_codigo } = body

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
      .select('monto_total, costo_envio, metodo_pago, cliente_nombre, cliente_email, cliente_telefono, cliente_dni, envio_detalle, cupon_codigo, descuento_cupon, descuento_outfit')
      .eq('id', ordenId)
      .maybeSingle()

    if (!orden) {
      return json({ error: 'El pedido no existe.' }, { status: 404 })
    }

    // Solo Mercado Pago genera preferencias acá. Si la orden es por
    // transferencia, no se debe abrir el checkout de MP.
    if (orden.metodo_pago && orden.metodo_pago !== 'mercadopago') {
      return json(
        { error: 'Esta orden no se paga por Mercado Pago.' },
        { status: 409 },
      )
    }

    // El costo de envío se toma del que YA validó `crear-orden` al guardar la
    // orden, no del body. Si difieren, el total de abajo no va a coincidir y
    // la preferencia se rechaza, pero lo comparamos explícitamente para que el
    // error sea entendible.
    const costoEnvioOrden = Number(orden.costo_envio ?? 0) || 0
    const costoEnvioBody = Number(costo_envio) || 0
    if (Math.abs(costoEnvioOrden - costoEnvioBody) > 0.01) {
      return json(
        { error: 'El costo de envío no coincide con el pedido.' },
        { status: 409 },
      )
    }

    const carrierEnvioOrden =
      (orden.envio_detalle as { carrier?: string | null } | null)?.carrier ?? carrier_envio

    const itemsInput = items as ItemInput[]

    // ---------------------------------------------------------------
    // PASO 1: releer los precios REALES desde la base de datos.
    // ---------------------------------------------------------------
    const ids = [...new Set(itemsInput.map((i) => String(i.producto_id ?? '')).filter(Boolean))]

    if (ids.length !== itemsInput.length) {
      return json({ error: 'Hay ítems sin producto_id.' }, { status: 400 })
    }

    const { data: productos, error: errorProductos } = await supabase
      .from('productos')
      .select('id, nombre, precio, discount_percent, activo, variaciones_stock(talle, stock_disponible)')
      .in('id', ids)

    if (errorProductos) {
      console.error('Error leyendo productos:', errorProductos)
      return json({ error: 'No se pudieron verificar los productos.' }, { status: 500 })
    }

    const catalogo = new Map<string, ProductoConTalles>(
      ((productos ?? []) as ProductoConTalles[]).map((p) => [String(p.id), p]),
    )

    const faltantes = ids.filter((id) => !catalogo.has(id))
    if (faltantes.length > 0) {
      return json(
        { error: `Producto inexistente: ${faltantes.join(', ')}.` },
        { status: 409 },
      )
    }

    const inactivos = ids.filter((id) => catalogo.get(id)?.activo === false)
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
      const producto = catalogo.get(String(item.producto_id))!

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
    if (costoEnvioNum <= 0 && carrierEnvioOrden) {
      const { data: config } = await supabase
        .from('config_tienda')
        .select('clave, valor')
        .in('clave', ['envio_gratis_activo', 'umbral_envio_gratis'])

      const activo = config?.find((c) => c.clave === 'envio_gratis_activo')?.valor === 'true'
      const umbral = Number(config?.find((c) => c.clave === 'umbral_envio_gratis')?.valor ?? 0)

      if (activo && umbral > 0 && subtotalReal < umbral) {
        return json(
          { error: `El envío gratis se aplica a compras desde $${umbral.toLocaleString('es-AR')}.` },
          { status: 409 },
        )
      }
    }

    // El cupón se recalcula acá: el descuento que envía el cliente no se confía
    let descuentoCupon = 0
    let etiquetaCupon = ''
    const codigoCupon = String(cupon_codigo ?? orden.cupon_codigo ?? '').trim().toUpperCase()

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
        name: cliente?.nombre ?? orden.cliente_nombre,
        email: cliente?.email ?? orden.cliente_email,
        phone: {
          area_code: '54',
          number: String(cliente?.telefono ?? orden.cliente_telefono)
            .replace(/\D/g, '')
            .replace(/^54/, '')
            .slice(0, 15),
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