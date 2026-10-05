import { supabase } from './supabase'
import type { OpcionEnvio, ResultadoCotizacion } from './enviopack'

export interface DatosOrden {
  cliente_nombre: string
  cliente_email: string
  cliente_telefono: string
  cliente_dni: string
  direccion: string
  codigo_postal: string
  metodo_pago: 'mercadopago' | 'transferencia'
  costo_envio: number
  envio?: {
    metodo: 'envio' | 'retiro'
    carrier?: string
    carrier_id?: number | null
    servicio?: string
    service_type?: string | null
    logistic_type?: string | null
    costo?: number
    codigo_postal?: string
    origen_cp?: string | null
    tiempo?: string | null
    mock?: boolean
    seleccion?: OpcionEnvio | null
    cotizacion?: ResultadoCotizacion | null
  }
  items: { producto_id: string; talle: string; cantidad: number; precio_unitario: number }[]
  /** Código del cupón aplicado, en mayúsculas */
  cupon_codigo?: string | null
}

/** Desglose que devuelve el servidor con los importes ya calculados. */
export interface ResumenOrden {
  ordenId: string
  monto_total: number
  subtotal: number
  descuento_transferencia: number
  descuento_cupon: number
  descuento_outfit: number
  costo_envio: number
  envio_gratis: boolean
}

/**
 * Crea la orden vía la Edge Function `crear-orden`, que recalcula precios,
 * descuento por transferencia y envío desde la base de datos.
 *
 * Ojo: el cliente NO envía `monto_total` ni descuentos. Se ignoran a propósito;
 * los importes reales son los que devuelve `resumen`.
 */
export async function crearOrden(datos: DatosOrden): Promise<
  ({ ordenId: string } & Partial<ResumenOrden>) & { error?: string }
> {
  const { data: sesion } = await supabase.auth.getSession()
  const token = sesion.session?.access_token

  const { data, error } = await supabase.functions.invoke('crear-orden', {
    body: {
      cliente_nombre: datos.cliente_nombre,
      cliente_email: datos.cliente_email,
      cliente_telefono: datos.cliente_telefono,
      cliente_dni: datos.cliente_dni,
      direccion: datos.direccion,
      codigo_postal: datos.codigo_postal,
      metodo_pago: datos.metodo_pago,
      costo_envio: datos.costo_envio,
      cupon_codigo: datos.cupon_codigo ?? null,
      envio: datos.envio,
      items: datos.items.map((i) => ({
        producto_id: i.producto_id,
        talle: i.talle,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
      })),
    },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })

  if (error) {
    return { ordenId: '', error: await leerError(error) }
  }

  const respuesta = data as Partial<ResumenOrden> & { error?: string }
  if (!respuesta?.ordenId) {
    return { ordenId: '', error: 'No pudimos crear el pedido.' }
  }

  return {
    ordenId: respuesta.ordenId,
    monto_total: respuesta.monto_total,
    subtotal: respuesta.subtotal,
    descuento_transferencia: respuesta.descuento_transferencia,
    descuento_cupon: respuesta.descuento_cupon,
    descuento_outfit: respuesta.descuento_outfit,
    costo_envio: respuesta.costo_envio,
    envio_gratis: respuesta.envio_gratis,
  }
}

/**
 * `supabase.functions.invoke` envuelve los errores de la función en un
 * `FunctionsHttpError` genérico. Intentamos leer el cuerpo para conservar el
 * mensaje real (por ejemplo "Stock insuficiente para ...").
 */
async function leerError(error: { message: string; context?: Response }): Promise<string> {
  try {
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      const cuerpo = (await ctx.json()) as { error?: string }
      if (cuerpo?.error) return cuerpo.error
    }
  } catch {
    // si no se puede leer, caemos al mensaje genérico
  }
  return error.message || 'No pudimos crear el pedido.'
}
