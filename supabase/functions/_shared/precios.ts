// ============================================================
// IKIGAI CLOTHES - Cálculo de precios en servidor
// ============================================================
// La Edge Function NUNCA confía en el precio que envía el cliente: siempre
// relee el producto desde la tabla `productos` y recalcula.
//
// Réplica exacta de src/lib/precios.ts → precioConDescuento(). Si cambiás la
// fórmula de descuento en el front, cambiala acá también (o al revés), si no
// el total del carrito y el de la orden dejan de coincidir y el pago falla.

export interface ProductoPrecio {
  id: string
  nombre: string
  precio: number | string | null
  discount_percent: number | string | null
  activo: boolean
}

/**
 * Precio final de venta de un producto, replicando
 * src/lib/precios.ts::precioConDescuento:
 *
 *   precioUnitario = round(precio * (100 - discount_percent)) / 100
 *
 * Nota: el precio de transferencia NO se usa acá. El descuento por
 * transferencia se aplica aparte, sobre el subtotal, y es un porcentaje de
 * tienda (config_tienda.descuento_transferencia), no un precio por producto.
 */
export function precioUnitarioReal(p: ProductoPrecio): number {
  const base = Number(p.precio) || 0
  const desc = Math.min(100, Math.max(0, Number(p.discount_percent) || 0))
  if (desc <= 0) return base
  return Math.round(base * (100 - desc)) / 100
}

/** Redondeo a 2 decimales, igual que el front. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}