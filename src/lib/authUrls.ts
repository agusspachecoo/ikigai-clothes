export const RESET_PASSWORD_PATH = '/restablecer-password'

/**
 * URL a la que Supabase redirige después de validar el enlace de recuperación.
 *
 * Se centraliza acá para que `resetPasswordForEmail`, la ruta de React y los
 * tests usen exactamente el mismo path. El `origin` es la ventana actual: así
 * funciona igual en localhost y en producción, y Supabase lo valida contra sus
 * "Redirect URLs".
 */
export function urlRestablecerPassword(origin: string = window.location.origin): string {
  return new URL(RESET_PASSWORD_PATH, origin).toString()
}

export interface DatosRecuperacionUrl {
  /** El enlace actual es un enlace de recuperación de contraseña. */
  esRecuperacion: boolean
  /** Tokens del flujo implícito (`#access_token=...`). */
  accessToken: string | null
  refreshToken: string | null
  /** Token de los flujos modernos por query (`?token_hash=...` o `?code=...`). */
  tokenHash: string | null
  code: string | null
  errorDescription: string | null
}

/**
 * Lee los datos de recuperación de la URL sin consumirlos.
 *
 * Supabase normalmente procesa el hash automáticamente (`detectSessionInUrl`),
 * pero leerlo nosotros nos permite:
 *  - mostrar la vista de cambio de contraseña apenas carga la app, sin que el
 *    modal de login alcance a abrirse;
 *  - tener un fallback con `setSession` si el cliente no llegó a procesar los
 *    tokens del hash antes de `getSession()`.
 *
 * No modifica la URL: el hash lo limpia Supabase/React Router después de que la
 * sesión queda establecida.
 */
export function leerRecuperacionDeUrl(
  url: string = window.location.href,
): DatosRecuperacionUrl {
  const parsed = new URL(url)
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''))
  const get = (clave: string) => hash.get(clave) ?? parsed.searchParams.get(clave)

  const type = get('type')
  const accessToken = get('access_token')
  const refreshToken = get('refresh_token')
  const tokenHash = get('token_hash')
  const code = get('code')
  const errorDescription = get('error_description')

  const esRecuperacion =
    type === 'recovery' ||
    (parsed.pathname === RESET_PASSWORD_PATH &&
      Boolean(accessToken || tokenHash || code || errorDescription))

  return {
    esRecuperacion,
    accessToken,
    refreshToken,
    tokenHash,
    code,
    errorDescription,
  }
}
