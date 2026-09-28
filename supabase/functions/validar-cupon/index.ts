// ============================================================
// IKIGAI CLOTHES - validar-cupon
// Valida un código de descuento contra el subtotal del carrito.
//
// Usa el service role a propósito: los cupones no tienen política de
// lectura pública, así que el navegador no puede enumerar los códigos.
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { validarCupon, type Cupon } from '../_shared/cupones.ts'

function getSupabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { codigo, subtotal } = await req.json()
    const subtotalNum = Number(subtotal) || 0

    if (!codigo || typeof codigo !== 'string') {
      return json({ ok: false, motivo: 'Ingresá un código de descuento.', descuento: 0 })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('cupones')
      .select('*')
      .eq('codigo', codigo.trim().toUpperCase())
      .maybeSingle()

    if (error) throw error

    const resultado = validarCupon((data ?? null) as Cupon | null, subtotalNum)

    if (!resultado.ok) {
      return json({ ok: false, motivo: resultado.motivo, descuento: 0 })
    }

    return json({
      ok: true,
      descuento: resultado.descuento,
      cupon: {
        codigo: resultado.cupon!.codigo,
        descripcion: resultado.cupon!.descripcion,
        tipo: resultado.cupon!.tipo,
        valor: resultado.cupon!.valor,
        // El navegador recalcula el descuento al cambiar el carrito, asi que
        // necesita el tope para que coincida con el calculo del servidor.
        descuento_maximo: resultado.cupon!.descuento_maximo,
      },
    })
  } catch (e) {
    return json(
      { ok: false, motivo: 'No pudimos validar el cupón. Probá de nuevo.', descuento: 0 },
      { status: 500 },
    )
  }
})
