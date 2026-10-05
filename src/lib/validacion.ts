const RE_DNI = /^\d{7,8}$/
const RE_TELEFONO = /^\d{10,11}$/
// Con prefijo +54 quedan 10 dígitos (landline) o 11 (celular, que conserva el
// 15). Antes pedía exactamente 10, así que un celular como +54 9 3755 73-2335
// se rechazaba.
const RE_TELEFONO_PREFIJO = /^\+54\d{10,11}$/

// Deliberadamente simple: no sirve para decidir si una casilla es real, solo para
// detectar que alguien wrote algo que no puede llegar a ser un email (falta el @,
// hay espacios, el dominio no tiene punto).
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Códigos postales argentinos: 4 dígitos (CPAlegacy) o 8 (CPA nuevo, con letra).
const RE_CP = /^\d{4}$/
const RE_CP_CPA = /^[A-Z]\d{4}[A-Z]{3}$/

export function esDNIValido(dni: string): boolean {
  return RE_DNI.test(dni.trim())
}

export function esTelefonoValido(telefono: string): boolean {
  const t = telefono.trim()
  return RE_TELEFONO.test(t) || RE_TELEFONO_PREFIJO.test(t)
}

export function esEmailValido(email: string): boolean {
  return RE_EMAIL.test(email.trim())
}

export function esCodigoPostalValido(cp: string): boolean {
  const t = cp.trim().toUpperCase()
  return RE_CP.test(t) || RE_CP_CPA.test(t)
}

/** Para mostrar el error antes de que el usuario termine de tipear. */
export function casiEsCodigoPostal(cp: string): boolean {
  return /^\d{1,3}$/.test(cp.trim())
}

export function esTextoValido(valor: string, minimo = 3): boolean {
  // Se valida por palabras: "Av. San Martín 1234" son 4 palabras, pero una
  // dirección corta como "Urquiza 55" es 2.
  return valor.trim().split(/\s+/).filter(Boolean).length >= minimo
}

export const MENSAJE_DNI =
  'El DNI debe tener entre 7 y 8 dígitos numéricos, sin puntos ni letras.'

export const MENSAJE_TELEFONO =
  'Ingresá un teléfono válido: 10 u 11 dígitos, por ejemplo 1155551234, o con prefijo +54.'

export const MENSAJE_EMAIL =
  'Revisá el email: le falta el @ o el dominio no es válido. Ej: nombre@mail.com'

export const MENSAJE_CP =
  'El código postal debe tener 4 dígitos (Ej: 3360) o ser un CPA completo (Ej: N3360ABC).'

export const MENSAJE_DIRECCION =
  'Completá la calle y el número. Ej: Av. San Martín 1234'

export const MENSAJE_OBLIGATORIO = 'Campo obligatorio.'

// ============================================
// VALIDACIÓN DEL FORMULARIO
// ============================================

export type Campo =
  | 'nombre'
  | 'apellido'
  | 'email'
  | 'telefono'
  | 'dni'
  | 'direccion'
  | 'codigo_postal'

export type ErroresFormulario = Partial<Record<Campo, string>>

export interface DatosFormulario {
  nombre: string
  apellido: string
  email: string
  telefono: string
  dni: string
  direccion: string
  codigo_postal: string
}

/**
 * Valida un campo y devuelve el mensaje, o `undefined` si está bien.
 *
 * Esto no decide si el error se muestra: eso lo hace la pantalla, según si el
 * usuario ya interactuó con el campo. Mientras está tipeando el DNI no tiene
 * sentido decirle que le faltan dígitos.
 */
export function validarCampo(
  campo: Campo,
  valor: string,
  { retiro = false }: { retiro?: boolean } = {},
): string | undefined {
  const v = valor.trim()

  // En retiro en showroom no se pide dirección ni CP.
  if (retiro && (campo === 'direccion' || campo === 'codigo_postal')) return undefined

  switch (campo) {
    case 'nombre':
    case 'apellido':
      if (!v) return MENSAJE_OBLIGATORIO
      if (v.length < 2) return 'Escribí al menos 2 letras.'
      if (/\d/.test(v)) return 'No puede contener números.'
      return undefined

    case 'email':
      if (!v) return MENSAJE_OBLIGATORIO
      if (!esEmailValido(v)) return MENSAJE_EMAIL
      return undefined

    case 'telefono':
      if (!v) return MENSAJE_OBLIGATORIO
      if (v.replace(/\D/g, '').length < 10) {
        return 'Te faltan dígitos: son 10 u 11.'
      }
      if (!esTelefonoValido(v)) return MENSAJE_TELEFONO
      return undefined

    case 'dni':
      if (!v) return MENSAJE_OBLIGATORIO
      if (v.replace(/\D/g, '').length < 7) {
        return 'Te faltan dígitos: son 7 u 8.'
      }
      if (!esDNIValido(v)) return MENSAJE_DNI
      return undefined

    case 'direccion':
      if (!v) return MENSAJE_OBLIGATORIO
      if (!esTextoValido(v, 2)) return MENSAJE_DIRECCION
      return undefined

    case 'codigo_postal':
      if (!v) return MENSAJE_OBLIGATORIO
      if (casiEsCodigoPostal(v)) return `Faltan dígitos (van ${v.trim().length} de 4).`
      if (!esCodigoPostalValido(v)) return MENSAJE_CP
      return undefined
  }
}

/** Valida todo el formulario y devuelve solo los campos con error. */
export function validarFormulario(
  datos: DatosFormulario,
  { retiro = false }: { retiro?: boolean } = {},
): ErroresFormulario {
  const campos: Campo[] = [
    'nombre',
    'apellido',
    'email',
    'telefono',
    'dni',
    'direccion',
    'codigo_postal',
  ]

  const errores: ErroresFormulario = {}
  for (const campo of campos) {
    const error = validarCampo(campo, datos[campo], { retiro })
    if (error) errores[campo] = error
  }
  return errores
}