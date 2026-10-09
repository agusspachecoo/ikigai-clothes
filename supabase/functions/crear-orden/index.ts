// ============================================================
// IKIGAI CLOTHES - crear-orden
// Crear una orden calculando TODOS los importes en el servidor.
//
// Por qué existe: antes el navegador insertaba la orden directo en PostgREST
// con `monto_total` calculado en el cliente. Eso permitía mandar
// monto_total: 1 y comprar cualquier prenda por transferencia.
//
// Reglas de oro acá:
//   * `precio_unitario` del cliente se IGNORA. Se relee de `productos`.
//   * `costo_envio` del cliente NO se cobra directo: se recalcula el envío
//     gratis contra `config_tienda` y se usa el valor cotizado.
//   * El descuento por transferencia sale de `config_tienda`, no del body.
//   * El cupón se revalida contra el subtotal real.
//   * El total se arma acá. El cliente no envía `monto_total` ni `descuento`.
//
// Usa service_role a propósito: las políticas de `ordenes` no permiten
// inserciones públicas (ver 019_security_fixes.sql), así que esta función es
// la única vía para crear una orden.
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { validarCupon, type Cupon } from '../_shared/cupones.ts'
import { precioUnitarioReal, round2, type ProductoPrecio } from '../_shared/precios.ts'
import { calcularDescuentoOutfit, type OutfitComposicion } from '../_shared/outfits.ts'

function getSupabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key)
}

interface ItemInput {
  producto_id: string
  talle?: string
  cantidad: number
  /** Viene del cliente pero NO se usa: se recalcula desde `productos`. */
  precio_unitario?: number
}

interface ProductoConTalles extends ProductoPrecio {
  variaciones_stock: { talle: string; stock_disponible: number }[]
}

const LARGO_MAX = {
  nombre: 120,
  email: 254,
  telefono: 32,
  dni: 16,
  direccion: 250,
  cp: 12,
}

function texto(valor: unknown, max: number): string {
  return String(valor ?? '').trim().slice(0, max)
}

/** Email con forma razonable. No es un validador RFC, solo descarta basura. */
function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
}

/** Solo dígitos, para armar el teléfono de Mercado Pago /AFIP. */
function soloDigitos(v: string): string {
  return v.replace(/\D/g, '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const {
      items,
      cliente_nombre,
      cliente_email,
      cliente_telefono,
      cliente_dni,
      direccion,
      codigo_postal,
      metodo_pago,
      costo_envio = 0,
      cupon_codigo,
      envio,
    } = body

    // ---------------------------------------------------------------
    // PASO 0: validación de entrada y de método de pago.
    // ---------------------------------------------------------------
    if (metodo_pago !== 'mercadopago' && metodo_pago !== 'transferencia') {
      return json({ error: 'Método de pago inválido.' }, { status: 400 })
    }

    if (!Array.isArray(items) || items.length === 0) {
      return json({ error: 'El carrito está vacío.' }, { status: 400 })
    }

    if (items.length > 50) {
      return json({ error: 'Demasiados ítems en el carrito.' }, { status: 400 })
    }

    const nombre = texto(cliente_nombre, LARGO_MAX.nombre)
    const email = texto(cliente_email, LARGO_MAX.email).toLowerCase()
    const telefono = texto(cliente_telefono, LARGO_MAX.telefono)
    const dni = soloDigitos(texto(cliente_dni, LARGO_MAX.dni))
    const dir = texto(direccion, LARGO_MAX.direccion)
    const cp = texto(codigo_postal, LARGO_MAX.cp)

    if (!nombre || !email || !telefono || !dni || !dir) {
      return json({ error: 'Completá nombre, email, teléfono, DNI y dirección.' }, { status: 400 })
    }

    if (!emailValido(email)) {
      return json({ error: 'El email no tiene un formato válido.' }, { status: 400 })
    }

    // Mismo criterio que el frontend (src/lib/validacion.ts): si se aprieta acá,
    // el cliente no debería ver un error que la pantalla ya le dejó pasar.
    // El 54 es código de país, no un dígito del número: hay que sacarlo antes
    // de contar, o un celular con prefijo internacional se rechaza.
    const digitosTel = soloDigitos(telefono).replace(/^54/, '')
    if (digitosTel.length < 10 || digitosTel.length > 11) {
      return json(
        { error: 'El teléfono debe tener 10 u 11 dígitos, por ejemplo 1155551234.' },
        { status: 400 },
      )
    }

    // DNI (7 u 8 dígitos) o CUIT (11). El formulario lo presenta como
    // "DNI / CUIT" y Mercado Pago acepta los dos como identification.number.
    const esDni = dni.length >= 7 && dni.length <= 8
    const esCuit = dni.length === 11
    if (!esDni && !esCuit) {
      return json(
        {
          error:
            'Ingresá el DNI (7 u 8 dígitos) o el CUIT (11 dígitos), sin puntos ni letras.',
        },
        { status: 400 },
      )
    }

    const esRetiro = envio?.metodo === 'retiro'

    if (!esRetiro) {
      if (!cp) {
        return json({ error: 'Falta el código postal.' }, { status: 400 })
      }
      if (soloDigitos(cp).length < 4) {
        return json(
          { error: 'El código postal debe tener 4 dígitos (ej. 3360) o ser un CPA completo.' },
          { status: 400 },
        )
      }
    }

    const supabase = getSupabaseAdmin()

    // ---------------------------------------------------------------
    // PASO 1: config de la tienda. El descuento por transferencia y el
    // umbral de envío gratis salen de acá, nunca del body.
    // ---------------------------------------------------------------
    const { data: filasConfig, error: errorConfig } = await supabase
      .from('config_tienda')
      .select('clave, valor')
      .in('clave', ['descuento_transferencia', 'umbral_envio_gratis', 'envio_gratis_activo'])

    if (errorConfig) {
      console.error('Error leyendo config_tienda:', errorConfig)
      return json({ error: 'No pudimos leer la configuración de la tienda.' }, { status: 500 })
    }

    const cfg = new Map((filasConfig ?? []).map((c) => [c.clave, c.valor]))

    // `descuento_transferencia` se guarda como porcentaje ('20' = 20%).
    const pctTransferencia = Math.min(
      1,
      Math.max(0, (Number(cfg.get('descuento_transferencia')) || 0) / 100),
    )
    const envioGratisActivo = cfg.get('envio_gratis_activo') === 'true'
    const umbralEnvioGratis = Number(cfg.get('umbral_envio_gratis')) || 0

    // ---------------------------------------------------------------
    // PASO 2: releer los precios REALES desde `productos`.
    // ---------------------------------------------------------------
    const itemsInput = items as ItemInput[]
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
      return json({ error: `Producto inexistente: ${faltantes.join(', ')}.` }, { status: 409 })
    }

    const inactivos = ids.filter((id) => catalogo.get(id)?.activo === false)
    if (inactivos.length > 0) {
      return json(
        { error: 'Uno o más productos del carrito ya no están disponibles.' },
        { status: 409 },
      )
    }

    // ---------------------------------------------------------------
    // PASO 3: reconstruir cada ítem con el precio del catálogo.
    // ---------------------------------------------------------------
    type ItemResuelto = {
      producto_id: string
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

      const variacion = (producto.variaciones_stock ?? []).find((v) => String(v.talle) === talle)

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
        talle,
        cantidad,
        precio_unitario: precioUnitarioReal(producto),
      })
    }

    const subtotalReal = round2(
      itemsResueltos.reduce((n, i) => n + i.precio_unitario * i.cantidad, 0),
    )

    // ---------------------------------------------------------------
    // PASO 3.5: descuento por outfit completo. Se leen los outfits activos
    // desde la base y se verifica que TODAS sus prendas estén en el carrito.
    // El cliente no manda ningún monto: acá se recalcula entero.
    // ---------------------------------------------------------------
    const { data: filasOutfits, error: errorOutfits } = await supabase
      .from('outfits')
      .select('outfit_items(producto_id)')
      .eq('activo', true)

    if (errorOutfits) {
      // No se cancela la compra por no poder calcular un descuento: se cobra
      // sin el 5%. `create-preference` recalcula y valida contra lo guardado,
      // así que un fallo persistente se ve como error al pagar, no como cobro
      // de menos.
      console.error('Error leyendo outfits:', errorOutfits)
    }

    const outfits: OutfitComposicion[] = (filasOutfits ?? []).map((o) => ({
      producto_ids: (o.outfit_items ?? []).map(
        (i: { producto_id: string }) => String(i.producto_id),
      ),
    }))

    const descuentoOutfit = calcularDescuentoOutfit(itemsResueltos, outfits)

    // ---------------------------------------------------------------
    // PASO 4: cupón, revalidado contra el subtotal real.
    // ---------------------------------------------------------------
    let descuentoCupon = 0
    const codigoCupon = String(cupon_codigo ?? '').trim().toUpperCase()

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
    }

    // ---------------------------------------------------------------
    // PASO 5: descuento por transferencia, calculado acá.
    // ---------------------------------------------------------------
    const descuentoTransferencia =
      metodo_pago === 'transferencia' ? round2(subtotalReal * pctTransferencia) : 0

    // ---------------------------------------------------------------
    // PASO 6: envío. Se recalcula el envío gratis contra la config.
    // ---------------------------------------------------------------
    const subtotalConDescuento = Math.max(
      0,
      round2(subtotalReal - descuentoTransferencia - descuentoCupon - descuentoOutfit),
    )

    // Normalizar CP para override Oberá
    const codigoPostalRaw = String(body.codigo_postal ?? '').trim()
    const codigoPostalDigits = codigoPostalRaw.replace(/\D/g, '')

    const esOberaGratis = !esRetiro && (codigoPostalDigits === '3360' || codigoPostalRaw.replace(/\D/g, '') === '3360')

    const correspondeEnvioGratis =
      esOberaGratis ||
      Number(costo_envio) === 0 && !esRetiro && codigoPostalDigits === '3360' ||
      (envioGratisActivo &&
        umbralEnvioGratis > 0 &&
        subtotalConDescuento >= umbralEnvioGratis)

    // El retiro siempre es gratis. Si no corresponde envío gratis, el costo
    // sale de la cotización del carrier que el cliente eligió con su CP.
    //
    // OJO: ese importe viene del navegador. No hay tabla de cotizaciones
    // persistidas contra la cual validarlo, así que se acota a un rango
    // razonable para descartar tanto un envío de $0 (robo de envío) como
    // cifras absurdas. Para eliminar la confianza por completo habría que
    // cotizar server-side contra la API del carrier usando el mismo CP.
    const COTIZACION_MIN = 500
    const COTIZACION_MAX = 500_000

    let costoEnvioFinal = 0

    if (correspondeEnvioGratis) {
      costoEnvioFinal = 0
    } else if (!esRetiro) {
      const cotizado = Number(envio?.costo ?? costo_envio) || 0

      if (cotizado <= 0) {
        return json(
          { error: 'No pudimos cotizar el envío. Volvé a elegir una opción de envío.' },
          { status: 409 },
        )
      }

      if (cotizado < COTIZACION_MIN || cotizado > COTIZACION_MAX) {
        return json({ error: 'El costo de envío cotizado no es válido.' }, { status: 409 })
      }

      costoEnvioFinal = round2(cotizado)
    }

    const montoTotal = round2(subtotalConDescuento + costoEnvioFinal)

    if (montoTotal < 0) {
      return json({ error: 'El total calculado no es válido.' }, { status: 500 })
    }

    // ---------------------------------------------------------------
    // PASO 7: insertar la orden con los importes del servidor.
    // ---------------------------------------------------------------
    const ordenId = crypto.randomUUID()

    const { error: errOrden } = await supabase.from('ordenes').insert([
      {
        id: ordenId,
        cliente_nombre: nombre,
        cliente_email: email,
        cliente_telefono: telefono,
        cliente_dni: dni,
        direccion: esRetiro ? 'Retiro en showroom' : dir,
        codigo_postal: esRetiro ? '' : cp,
        metodo_pago,
        monto_total: montoTotal,
        costo_envio: costoEnvioFinal,
        cupon_codigo: codigoCupon || null,
        descuento_cupon: descuentoCupon,
        descuento_outfit: descuentoOutfit,
        ...(envio ? { envio_detalle: envio } : {}),
      },
    ])

    if (errOrden) {
      console.error('Error creando orden:', errOrden)
      return json({ error: 'No pudimos registrar el pedido.' }, { status: 500 })
    }

    const { error: errItems } = await supabase.from('orden_items').insert(
      itemsResueltos.map((i) => ({
        orden_id: ordenId,
        producto_id: i.producto_id,
        talle: i.talle,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
      })),
    )

    if (errItems) {
      // No dejamos una orden huérfana sin items.
      await supabase.from('ordenes').delete().eq('id', ordenId)
      console.error('Error creando items de la orden:', errItems)
      return json({ error: 'No pudimos registrar los productos del pedido.' }, { status: 500 })
    }

    // ---------------------------------------------------------------
    // PASO 8: devolver el desglose real, para que el front lo muestre.
    // ---------------------------------------------------------------
    return json(
      {
        ordenId,
        monto_total: montoTotal,
        subtotal: subtotalReal,
        descuento_transferencia: descuentoTransferencia,
        descuento_cupon: descuentoCupon,
        descuento_outfit: descuentoOutfit,
        costo_envio: costoEnvioFinal,
        envio_gratis: correspondeEnvioGratis || esRetiro,
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('crear-orden error:', err)
    return json({ error: 'Error inesperado al crear el pedido.' }, { status: 500 })
  }
})