export function precioConDescuento(
  precio: number | null | undefined,
  discountPercent: number | null | undefined,
): number {
  const base = Number(precio) || 0
  const desc = Math.min(100, Math.max(0, Number(discountPercent) || 0))
  if (desc <= 0) return base
  return Math.round(base * (100 - desc)) / 100
}

export function formatearPrecio(valor: number | null | undefined): string {
  return Math.round(Number(valor) || 0).toLocaleString('es-AR')
}

/** Precio final pagando por transferencia (descuento de la tienda). */
export function precioTransferencia(precio: number, descuentoTransferencia: number): number {
  return Math.round(precio * (1 - descuentoTransferencia) * 100) / 100
}

/** Monto de cada cuota sin interés. */
export function montoCuota(total: number, cuotas: number): number {
  return Math.round(total / Math.max(1, cuotas))
}
