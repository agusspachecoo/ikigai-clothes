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
  /** Descuento total aplicado (outfits + cupón) */
  descuento?: number
  /** Código del cupón aplicado, en mayúsculas */
  cupon_codigo?: string | null
  /** Monto del descuento otorgado por el cupón */
  descuento_cupon?: number
}

export async function crearOrden(datos: DatosOrden) {
  const ordenId = crypto.randomUUID()
  const monto_total =
    datos.items.reduce((n, i) => n + i.cantidad * i.precio_unitario, 0) +
    Number(datos.costo_envio || 0) -
    Number(datos.descuento || 0)

  const { error: errOrden } = await supabase.from('ordenes').insert([{
    id: ordenId,
    cliente_nombre: datos.cliente_nombre,
    cliente_email: datos.cliente_email,
    cliente_telefono: datos.cliente_telefono,
    cliente_dni: datos.cliente_dni,
    direccion: datos.direccion,
    codigo_postal: datos.codigo_postal,
    metodo_pago: datos.metodo_pago,
    monto_total,
    costo_envio: datos.costo_envio,
    cupon_codigo: datos.cupon_codigo ?? null,
    descuento_cupon: datos.descuento_cupon ?? 0,
    ...(datos.envio ? { envio_detalle: datos.envio } : {}),
  }])

  if (errOrden) return { ordenId, error: errOrden.message }

  const { error: errItems } = await supabase.from('orden_items').insert(
    datos.items.map(i => ({ orden_id: ordenId, ...i })),
  )

  if (errItems) return { ordenId, error: errItems.message }

  return { ordenId }
}
