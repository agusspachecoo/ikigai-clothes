import type { CartItem } from '../types/cart'
import type { MetodoPago } from './pagos'

/**
 * Resumen del pedido tal como lo devolvió el servidor, listo para mostrar.
 *
 * Es lo que se guarda en `sessionStorage` antes de saltar a Mercado Pago, para
 * que la pantalla de resultado pueda mostrar el desglose aunque el comprador no
 * tenga cuenta.
 */
export interface ResumenPedido {
  id: string
  metodo: MetodoPago
  items: CartItem[]
  /** Subtotal de productos, sin descuentos ni envío. */
  subtotal: number
  descuentoTransferencia: number
  descuentoCupon: number
  /** Descuento por outfit completo, calculado por el servidor */
  descuentoOutfit: number
  costoEnvio: number
  envioGratis: boolean
  total: number
  cuponCodigo: string | null
  /** Etiqueta lista para mostrar del método de envío elegido. */
  envioLabel: string
  retiro: boolean
  nombre: string
  email: string
}

const PREFIJO = 'ikigai:pedido:'
/**
 * Puntero al último resumen guardado.
 *
 * Mercado Pago no siempre devuelve `external_reference`: si el usuario abandona
 * la pantalla de Mercado Pago y vuelve al navegador, o si el pago falla antes de generarse la
 * preferencia, el retorno llega sin ese query param. Con este puntero la
 * pantalla de resultado igual encuentra el pedido que se acaba de armar.
 */
const CLAVE_ULTIMO = `${PREFIJO}ultimo`

function clave(id: string) {
  return `${PREFIJO}${id}`
}

/**
 * Guarda el resumen para poder recuperarlo después de la redirección.
 *
 * Va en `sessionStorage` y no en `localStorage` a propósito: es información de
 * la pestaña actual, se descarta al cerrarla y no queda en el disco del
 * navegador. Contiene nombre y email del comprador, así que interesa que muera
 * rápido.
 *
 * Si el navegador bloquea el storage (modo privado viejo, `iframe` sin
 * permisos) no es un error que deba frenar el pago: se sigue con la
 * redirección y el resumen simplemente no se podrá recuperar después.
 */
export function guardarResumen(pedido: ResumenPedido) {
  try {
    sessionStorage.setItem(clave(pedido.id), JSON.stringify(pedido))
    sessionStorage.setItem(CLAVE_ULTIMO, pedido.id)
  } catch {
    // Sin storage disponible: el pago continúa igual, solo se pierde el detalle.
  }
}

/**
 * Lee el resumen de un pedido.
 *
 * Si `id` viene vacío, cae al puntero del último pedido guardado: Mercado Pago
 * no siempre devuelve `external_reference` (por ejemplo si el usuario cierra
 * la pestaña del checkout y vuelve al navegador a mano).
 */
export function leerResumen(id: string): ResumenPedido | null {
  let pedidoId = id.trim()
  if (!pedidoId) {
    try {
      pedidoId = sessionStorage.getItem(CLAVE_ULTIMO)?.trim() ?? ''
    } catch {
      return null
    }
  }
  if (!pedidoId) return null

  let crudo: string | null
  try {
    crudo = sessionStorage.getItem(clave(pedidoId))
  } catch {
    return null
  }
  if (!crudo) return null

  try {
    const datos = JSON.parse(crudo) as Partial<ResumenPedido>
    // Validación mínima: si algo falta, es preferible mostrar la pantalla sin
    // desglose que renderizar NaN o romper el `.map` sobre los items.
    if (!Array.isArray(datos.items) || typeof datos.total !== 'number') return null
    return {
      id: pedidoId,
      metodo: datos.metodo === 'transferencia' ? 'transferencia' : 'mercadopago',
      items: datos.items,
      subtotal: Number(datos.subtotal ?? 0),
      descuentoTransferencia: Number(datos.descuentoTransferencia ?? 0),
      descuentoCupon: Number(datos.descuentoCupon ?? 0),
      descuentoOutfit: Number(datos.descuentoOutfit ?? 0),
      costoEnvio: Number(datos.costoEnvio ?? 0),
      envioGratis: Boolean(datos.envioGratis),
      total: Number(datos.total),
      cuponCodigo: datos.cuponCodigo ?? null,
      envioLabel: datos.envioLabel ?? '',
      retiro: Boolean(datos.retiro),
      nombre: datos.nombre ?? '',
      email: datos.email ?? '',
    }
  } catch {
    // JSON inválido: se descarta.
    return null
  }
}

/**
 * Borra los resúmenes viejos, conservando el del pedido en curso.
 *
 * Si el pago falla, el usuario vuelve al checkout e intenta de nuevo: la orden
 * anterior queda huérfana en el storage. No se borra el del pedido actual porque
 * si vuelve a redirigirse (por ejemplo reintenta desde otro dispositivo) el
 * resumen tiene que seguir ahí.
 *
 * Devuelve cuántos se borraron, para poder avisar por log si el storage se está
 * llenando.
 */
export function podarResumen(conservarId: string): number {
  let borrados = 0
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i)
      if (!k || !k.startsWith(PREFIJO)) continue
      if (k === clave(conservarId) || k === CLAVE_ULTIMO) continue
      sessionStorage.removeItem(k)
      borrados++
    }

    // El puntero tiene que seguir apuntando a algo que exista: si el pedido
    // conservado no está, se limpia, así no queda la referencia a un
    // pedido que ya no está.
    if (!sessionStorage.getItem(clave(conservarId))) {
      sessionStorage.removeItem(CLAVE_ULTIMO)
    }
  } catch {
    return borrados
  }
  return borrados
}