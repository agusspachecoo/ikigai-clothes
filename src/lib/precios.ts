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

/**
 * Precio de lista que corresponde a un precio de transferencia, invirtiendo el
 * descuento global de la tienda:
 *
 *   precioLista = precioTransferencia / (1 - descuentoTransferencia)
 *
 * Ej: 40000 / (1 - 0.2) = 50000.
 */
export function precioListaDesdeTransferencia(
  precioTransferenciaValor: number,
  descuentoTransferencia: number,
): number {
  const transferencia = Number(precioTransferenciaValor) || 0
  if (transferencia <= 0) return 0

  const descuento = Number(descuentoTransferencia)
  if (!Number.isFinite(descuento) || descuento <= 0 || descuento >= 1) {
    return transferencia
  }

  return Math.round((transferencia / (1 - descuento)) * 100) / 100
}

/**
 * Invierte un descuento porcentual (0-100) para recuperar el precio base.
 * El admin muestra los precios finales en los inputs y usa esta función al
 * guardar para no aplicar dos veces el descuento promocional en la tienda.
 */
export function precioBaseDesdeFinal(
  precioFinal: number | null | undefined,
  descuentoPercent: number | null | undefined,
): number {
  const final = Number(precioFinal) || 0
  if (final <= 0) return 0
  const desc = Math.min(99.99, Math.max(0, Number(descuentoPercent) || 0))
  return Math.round((final / (1 - desc / 100)) * 100) / 100
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

/** Indica si el producto tiene un precio de transferencia propio válido. */
export function tienePrecioTransferenciaPropio(
  precioTransferenciaPropio: number | null | undefined,
): boolean {
  const valor = Number(precioTransferenciaPropio)
  return Number.isFinite(valor) && valor > 0
}

/**
 * Precio final por transferencia de un producto.
 *
 * `precioLista` debe ser el precio ya descontado (`precioConDescuento`).
 * Prioriza el valor guardado en `productos.precio_transferencia` cuando existe,
 * pero le aplica el descuento promocional de la prenda: si no, una oferta
 * quedaba "por debajo" del precio transferencia y el precio más grande de la
 * tarjeta seguía siendo el de lista.
 *
 * Solo si el producto no define uno propio se aplica el porcentaje global de la
 * tienda (`config_tienda.descuento_transferencia`).
 */
export function precioTransferenciaProducto(
  precioLista: number,
  descuentoTransferencia: number,
  precioTransferenciaPropio?: number | null,
  discountPercent?: number | null,
): number {
  if (tienePrecioTransferenciaPropio(precioTransferenciaPropio)) {
    return precioConDescuento(Number(precioTransferenciaPropio), discountPercent)
  }
  return precioTransferencia(precioLista, descuentoTransferencia)
}

/**
 * Porcentaje de ahorro real que representa el precio de transferencia sobre el
 * precio de lista/oferta mostrado. Se calcula sobre los valores finales para no
 * anunciar el porcentaje global cuando el producto tiene un precio propio.
 */
export function porcentajeAhorroTransferencia(
  precioLista: number,
  precioTransferenciaFinal: number,
): number {
  const base = Number(precioLista) || 0
  const final = Number(precioTransferenciaFinal) || 0
  if (base <= 0 || final <= 0 || final >= base) return 0
  return Math.round(((base - final) / base) * 10000) / 100
}
