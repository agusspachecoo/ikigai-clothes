import { supabase } from './supabase'

export type EstadoCuentaInvitado = 'creada' | 'existente' | 'ya-logueado' | 'error'

export interface ResultadoCuentaInvitado {
  estado: EstadoCuentaInvitado
  email?: string
  sesionIniciada: boolean
  error?: string
}

interface RespuestaCuenta {
  creada?: boolean
  existente?: boolean
  email?: string
  password?: string
  error?: string
}

function claveResultado(ordenId: string): string {
  return `ikigai-cuenta-invitado:${ordenId}`
}

function leerResultado(ordenId: string): ResultadoCuentaInvitado | null {
  try {
    const guardado = sessionStorage.getItem(claveResultado(ordenId))
    if (!guardado) return null
    const resultado = JSON.parse(guardado) as ResultadoCuentaInvitado
    if (resultado.estado === 'creada' || resultado.estado === 'existente') {
      return resultado
    }
  } catch {
    return null
  }
  return null
}

function guardarResultado(ordenId: string, resultado: ResultadoCuentaInvitado) {
  try {
    sessionStorage.setItem(claveResultado(ordenId), JSON.stringify(resultado))
  } catch {
    return
  }
}

async function leerError(error: { message: string; context?: Response }): Promise<string> {
  try {
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      const cuerpo = (await ctx.json()) as { error?: string }
      if (cuerpo?.error) return cuerpo.error
    }
  } catch {
    return error.message || 'No pudimos crear tu cuenta.'
  }
  return error.message || 'No pudimos crear tu cuenta.'
}

const enCurso = new Map<string, Promise<ResultadoCuentaInvitado>>()

export function crearCuentaInvitado(ordenId: string): Promise<ResultadoCuentaInvitado> {
  if (!ordenId) {
    return Promise.resolve({
      estado: 'error',
      sesionIniciada: false,
      error: 'No encontramos el pedido.',
    })
  }

  const guardado = leerResultado(ordenId)
  if (guardado) return Promise.resolve(guardado)

  const pendiente = enCurso.get(ordenId)
  if (pendiente) return pendiente

  const promesa = crearCuentaInvitadoInterno(ordenId).finally(() => {
    enCurso.delete(ordenId)
  })
  enCurso.set(ordenId, promesa)
  return promesa
}

async function crearCuentaInvitadoInterno(ordenId: string): Promise<ResultadoCuentaInvitado> {
  const { data: sesion } = await supabase.auth.getSession()
  if (sesion.session) {
    return {
      estado: 'ya-logueado',
      email: sesion.session.user.email ?? undefined,
      sesionIniciada: true,
    }
  }

  let respuesta: RespuestaCuenta
  try {
    const { data, error } = await supabase.functions.invoke('crear-cuenta-invitado', {
      body: { ordenId },
    })

    if (error) {
      return { estado: 'error', sesionIniciada: false, error: await leerError(error) }
    }

    respuesta = (data ?? {}) as RespuestaCuenta
  } catch (err) {
    return {
      estado: 'error',
      sesionIniciada: false,
      error: err instanceof Error ? err.message : 'No pudimos crear tu cuenta.',
    }
  }

  if (respuesta.error) {
    return { estado: 'error', sesionIniciada: false, error: respuesta.error }
  }

  if (respuesta.existente) {
    const resultado: ResultadoCuentaInvitado = {
      estado: 'existente',
      email: respuesta.email,
      sesionIniciada: false,
    }
    guardarResultado(ordenId, resultado)
    return resultado
  }

  if (!respuesta.creada || !respuesta.email || !respuesta.password) {
    return { estado: 'error', sesionIniciada: false, error: 'No pudimos crear tu cuenta.' }
  }

  const { error: errLogin } = await supabase.auth.signInWithPassword({
    email: respuesta.email,
    password: respuesta.password,
  })

  const resultado: ResultadoCuentaInvitado = {
    estado: 'creada',
    email: respuesta.email,
    sesionIniciada: !errLogin,
    error: errLogin ? 'Creamos tu cuenta, pero no pudimos iniciar sesión automáticamente.' : undefined,
  }

  if (!errLogin) guardarResultado(ordenId, resultado)

  return resultado
}
