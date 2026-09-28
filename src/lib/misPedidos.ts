import { supabase } from './supabase'
import type { Orden, OrdenItem } from '../types/database'

export type OrdenItemConProducto = OrdenItem & {
  producto: { nombre: string; imagenes: string[] } | null
}

export type OrdenConItems = Orden & {
  orden_items: OrdenItemConProducto[]
}

export async function getMisPedidos(email: string) {
  const { data, error } = await supabase
    .from('ordenes')
    .select('*, orden_items(*, producto:productos(nombre, imagenes))')
    .eq('cliente_email', email)
    .order('created_at', { ascending: false })

  return { data: (data ?? []) as OrdenConItems[], error: error?.message ?? null }
}

export const ESTADO_PEDIDO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente de pago',
  pendiente_verificacion: 'Comprobante por verificar',
  pagado: 'Pagado',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

export const ESTADO_PEDIDO_CLASS: Record<string, string> = {
  pendiente: 'badge-warning',
  pendiente_verificacion: 'badge-warning',
  pagado: 'badge-info',
  enviado: 'badge-success',
  entregado: 'badge-success',
  cancelado: 'badge-error',
}