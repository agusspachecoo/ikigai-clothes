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

/**
 * Porcentaje exacto (0-100) que representa el descuento por transferencia de
 * la tienda, tal como se guarda en `config_tienda` (ej: 0.2 → 20).
 */
export function porcentajeDesdeDescuentoTransferencia(descuento: number): number {
  return Math.round((Number(descuento) || 0) * 10000) / 100
}

/**
 * Precio final por transferencia de un producto. Se calcula siempre con el
 * porcentaje global de la tienda (`config_tienda.descuento_transferencia`).
 *
 * El valor `productos.precio_transferencia` queda solo como dato histórico:
 * no se usa para mostrar precios porque podía quedar desactualizado y mostrar
 * un porcentaje distinto al configurado (por ejemplo 17% en vez de 20%).
 */
export function precioTransferenciaProducto(
  precioLista: number,
  descuentoTransferencia: number,
): number {
  return precioTransferencia(precioLista, descuentoTransferencia)
}
