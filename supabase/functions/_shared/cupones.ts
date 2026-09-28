// ============================================================
// Lógica de cupones compartida entre Edge Functions
// ============================================================

export interface Cupon {
  codigo: string
  descripcion: string | null
  tipo: 'porcentaje' | 'fijo'
  valor: number
  descuento_maximo: number | null
  minimo_compra: number
  usos: number
  usos_max: number | null
  fecha_inicio: string | null
  fecha_fin: string | null
  activo: boolean
}

export interface ResultadoValidacion {
  ok: boolean
  motivo?: string
  descuento: number
  cupon?: Cupon
}

const HOY = () => new Date()

/** Motivo por el que un cupón no se puede aplicar (o string vacío si aplica). */
export function motivoRechazo(c: Cupon, subtotal: number, ahora = HOY()): string {
  if (!c.activo) return 'El cupón no está activo.'
  if (c.fecha_inicio && new Date(c.fecha_inicio) > ahora)
    return 'El cupón todavía no está disponible.'
  if (c.fecha_fin && new Date(c.fecha_fin) < ahora) return 'El cupón venció.'
  if (c.usos_max !== null && c.usos >= c.usos_max) return 'El cupón llegó a su límite de usos.'
  if (subtotal < Number(c.minimo_compra))
    return `El cupón aplica desde $${Number(c.minimo_compra).toLocaleString('es-AR')}.`
  return ''
}

/** Descuento en pesos para un cupón sobre un subtotal dado. */
export function calcularDescuento(c: Cupon, subtotal: number): number {
  const base = Number(subtotal) || 0
  if (base <= 0) return 0

  let descuento =
    c.tipo === 'porcentaje'
      ? (base * Number(c.valor)) / 100
      : Number(c.valor)

  if (c.descuento_maximo !== null) {
    descuento = Math.min(descuento, Number(c.descuento_maximo))
  }

  // Nunca se descuenta más que el subtotal (el envío nunca entra en el descuento)
  return Math.max(0, Math.min(Math.round(descuento * 100) / 100, base))
}

export function validarCupon(c: Cupon | null, subtotal: number): ResultadoValidacion {
  if (!c) return { ok: false, motivo: 'El cupón no existe.', descuento: 0 }

  const motivo = motivoRechazo(c, subtotal)
  if (motivo) return { ok: false, motivo, descuento: 0 }

  const descuento = calcularDescuento(c, subtotal)
  if (descuento <= 0) return { ok: false, motivo: 'El cupón no aplica a este monto.', descuento: 0 }

  return { ok: true, descuento, cupon: c }
}
