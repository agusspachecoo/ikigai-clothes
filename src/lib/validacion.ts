const RE_DNI = /^\d{7,8}$/
const RE_TELEFONO = /^\d{10,11}$/
const RE_TELEFONO_PREFIJO = /^\+54\d{10}$/

export function esDNIValido(dni: string): boolean {
  return RE_DNI.test(dni.trim())
}

export function esTelefonoValido(telefono: string): boolean {
  const t = telefono.trim()
  return RE_TELEFONO.test(t) || RE_TELEFONO_PREFIJO.test(t)
}

export const MENSAJE_DNI =
  'El DNI debe tener entre 7 y 8 dígitos numéricos, sin puntos ni letras.'

export const MENSAJE_TELEFONO =
  'Ingresá un teléfono válido: 10 u 11 dígitos, por ejemplo 1155551234, o con prefijo +54.'