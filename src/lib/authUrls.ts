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
