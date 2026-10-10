const RE_DNI = /^\d{7,8}$/
const RE_CUIT = /^\d{11}$/
// Un teléfono con TODOS los dígitos iguales ("1111111111") es un dato falso típico.
const RE_TELEFONO_REPETIDO = /^(\d)\1+$/

// Deliberadamente simple: no sirve para decidir si una casilla es real, solo para
// detectar que alguien wrote algo que no puede llegar a ser un email (falta el @,
// hay espacios, el dominio no tiene punto).
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Códigos postales argentinos: 4 dígitos (CPAlegacy) o 8 (CPA nuevo, con letra).
const RE_CP = /^\d{4}$/
const RE_CP_CPA = /^[A-Z]\d{4}[A-Z]{3}$/

/**
 * DNI (7 u 8 dígitos) o CUIT (11). El formulario lo llama "DNI / CUIT", así que
 * la validación tiene que aceptar los dos: si sólo admitiera el DNI, quien
 * escribiera el CUIT quedaría trabado en un error que no puede resolver.
 */
export function esDNIValido(dni: string): boolean {
  const v = dni.trim()
  return RE_DNI.test(v) || RE_CUIT.test(v)
}

/**
 * Deja solo los dígitos del teléfono: descarta espacios, guiones, paréntesis,
 * el signo '+' y cualquier otro carácter.
 */
export function limpiarTelefono(telefono: string): string {
  return telefono.replace(/\D/g, '')
}

/**
 * Detecta números falsos obvios: todos los dígitos iguales ("1111111111") o una
 * secuencia consecutiva completa ("1234567890" / "0987654321").
 *
 * Se evalúa sobre los 10 dígitos netos, no sobre el prefijo internacional.
 */
function esTelefonoFalso(digitos: string): boolean {
  if (RE_TELEFONO_REPETIDO.test(digitos)) return true

  // Secuencia completa ascendente ("1234567890") o descendente ("0987654321").
  // Se usa aritmética módulo 10 para contemplar el salto 9 -> 0.
  let ascendente = true
  let descendente = true
  for (let i = 1; i < digitos.length; i++) {
    const actual = digitos.charCodeAt(i) - 48
    const previo = digitos.charCodeAt(i - 1) - 48
    if (((actual - previo + 10) % 10) !== 1) ascendente = false
    if (((previo - actual + 10) % 10) !== 1) descendente = false
  }
  return ascendente || descendente
}

/**
 * Valida un teléfono argentino con criterio estricto:
 *
 *  - 10 dígitos netos (código de área + número local), ej. 3755732335;
 *  - prefijo internacional de celular '549' + 10 dígitos (13 en total);
 *  - prefijo internacional de fijo '54' + 10 dígitos (12 en total).
 *
 * Antes de validar se limpia el número. Se rechazan los patrones falsos
 * evidentes (dígitos repetidos o secuencias consecutivas).
 */
export function esTelefonoValido(telefono: string): boolean {
  const digitos = limpiarTelefono(telefono)

  let netos: string
  if (digitos.length === 10) {
    netos = digitos
  } else if (digitos.length === 13 && digitos.startsWith('549')) {
    netos = digitos.slice(3)
  } else if (digitos.length === 12 && digitos.startsWith('54')) {
    netos = digitos.slice(2)
  } else {
    return false
  }

  return !esTelefonoFalso(netos)
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
  'Ingresá el DNI (7 u 8 dígitos) o el CUIT (11 dígitos), sin puntos ni letras.'

export const MENSAJE_TELEFONO =
  'Ingresá un teléfono válido de 10 dígitos (código de área + número), por ejemplo 1155551234 o 3755732335. También se acepta con prefijo +54 o +549.'

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

    case 'telefono': {
      if (!v) return MENSAJE_OBLIGATORIO
      const digitos = limpiarTelefono(v)
      if (digitos.length < 10) {
        return `Te faltan dígitos: van ${digitos.length} de 10.`
      }
      if (!esTelefonoValido(v)) return MENSAJE_TELEFONO
      return undefined
    }

    case 'dni':
      if (!v) return MENSAJE_OBLIGATORIO
      if (v.replace(/\D/g, '').length < 7) {
        return 'Te faltan dígitos: el DNI lleva 7 u 8 y el CUIT 11.'
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