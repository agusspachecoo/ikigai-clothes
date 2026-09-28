import { supabase } from './supabase'

export interface CuponAplicado {
  codigo: string
  descripcion: string | null
  tipo: 'porcentaje' | 'fijo'
  valor: number
  /** Tope del descuento en pesos; el backend nunca descuenta más que esto */
  descuento_maximo: number | null
}

export type ResultadoCupon =
  | { ok: true; descuento: number; cupon: CuponAplicado }
  | { ok: false; motivo: string }

/**
 * Espejo de la lógica de `supabase/functions/_shared/cupones.ts`.
 * Se usa para recalcular el descuento cuando cambia el carrito; el pago
 * siempre lo vuelve a validar la Edge Function.
 */
export function calcularDescuentoCupon(
  cupon: CuponAplicado | null,
  subtotal: number,
): number {
  if (!cupon || subtotal <= 0) return 0

  let descuento =
    cupon.tipo === 'porcentaje' ? (subtotal * Number(cupon.valor)) / 100 : Number(cupon.valor)

  if (cupon.descuento_maximo != null) {
    descuento = Math.min(descuento, Number(cupon.descuento_maximo))
  }

  return Math.max(0, Math.min(Math.round(descuento * 100) / 100, subtotal))
}

/**
 * Valida un cupón contra la Edge Function `validar-cupon`.
 * Los códigos no tienen política de lectura pública: la validación va por
 * backend justamente para que el navegador no pueda enumerar promociones.
 */
export async function aplicarCupon(codigo: string, subtotal: number): Promise<ResultadoCupon> {
  const { data, error } = await supabase.functions.invoke('validar-cupon', {
    body: { codigo, subtotal },
  })

  if (error) return { ok: false, motivo: 'No pudimos validar el cupón. Probá de nuevo.' }
  if (!data?.ok) return { ok: false, motivo: data?.motivo ?? 'El cupón no es válido.' }

  return { ok: true, descuento: Number(data.descuento) || 0, cupon: data.cupon }
}
