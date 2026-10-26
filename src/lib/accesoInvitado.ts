import { supabase } from './supabase'
import type { ResumenPedido } from './resumenPedido'

interface RespuestaConsultar {
  orden?: ResumenPedido & { estado?: string; estadoPago?: string; createdAt?: string }
  error?: string
}

async function leerError(error: { message: string; context?: Response }): Promise<string> {
  try {
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      const cuerpo = (await ctx.json()) as { error?: string }
      if (cuerpo?.error) return cuerpo.error
    }
  } catch {
    // sin cuerpo legible
  }
  return error.message || 'No pudimos consultar el pedido.'
}

export async function consultarPedidoInvitado(
  ordenId: string,
  ordenToken?: string | null,
): Promise<{ pedido: ResumenPedido | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('acceso-invitado', {
    body: {
      action: 'consultar',
      ordenId,
      ordenToken: ordenToken || undefined,
    },
  })

  if (error) return { pedido: null, error: await leerError(error) }

  const respuesta = (data ?? {}) as RespuestaConsultar
  if (!respuesta.orden) {
    return { pedido: null, error: respuesta.error ?? 'No pudimos consultar el pedido.' }
  }

  return {
    pedido: { ...respuesta.orden, ordenToken: ordenToken ?? null },
    error: null,
  }
}

export async function reclamarPedidoInvitado(
  ordenId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('acceso-invitado', {
    body: { action: 'reclamar', ordenId },
  })

  if (error) return { ok: false, error: await leerError(error) }

  const respuesta = (data ?? {}) as { ok?: boolean; error?: string }
  return { ok: respuesta.ok === true, error: respuesta.error ?? null }
}
