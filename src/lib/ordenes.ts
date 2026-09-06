import { supabase } from './supabase'

export interface DatosOrden {
  cliente_nombre: string
  cliente_email: string
  cliente_telefono: string
  cliente_dni: string
  direccion: string
  codigo_postal: string
  metodo_pago: 'mercadopago' | 'transferencia'
  costo_envio: number
  items: { producto_id: string; talle: string; cantidad: number; precio_unitario: number }[]
}

export async function crearOrden(datos: DatosOrden) {
  const ordenId = crypto.randomUUID()
  const monto_total = datos.items.reduce((n, i) => n + i.cantidad * i.precio_unitario, 0)

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
  }])

  if (errOrden) return { ordenId, error: errOrden.message }

  const { error: errItems } = await supabase.from('orden_items').insert(
    datos.items.map(i => ({ orden_id: ordenId, ...i })),
  )

  if (errItems) return { ordenId, error: errItems.message }

  return { ordenId }
}
