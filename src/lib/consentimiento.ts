/**
 * Consentimiento de cookies y almacenamiento local.
 *
 * La app guarda el carrito y las preferencias en `localStorage` (esencial,
 * no requiere consentimiento). Lo único que necesita permiso explícito es la
 * analítica de terceros (GA4), porque implica perfilado del usuario.
 *
 * Por eso `BannerCookies` monta antes que `Analytics` en el layout: si el
 * usuario acepta, el tag de GA4 se inyecta después; si rechaza, nunca se
 * descarga el script.
 */

export type Consentimiento = 'esencial' | 'todo' | null

const CLAVE = 'ikigai-consentimiento-v1'
const EVENTO = 'ikigai:consentimiento-cambia'
const EVENTO_ABRIR = 'ikigai:consentimiento-abrir'

export function leerConsentimiento(): Consentimiento {
  try {
    const valor = localStorage.getItem(CLAVE)
    return valor === 'todo' || valor === 'esencial' ? valor : null
  } catch {
    // Modo privado o storage bloqueado:NOS PREGUNTAMOS. Tratar como "sin
    // decidir" hace que el banner vuelva a mostrarse, que es lo correcto.
    return null
  }
}

export function guardarConsentimiento(valor: Exclude<Consentimiento, null>) {
  try {
    localStorage.setItem(CLAVE, valor)
  } catch {
    // Si no se puede guardar, la decisión igual se aplica en esta sesión.
  }
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: valor }))
}

export function permitirAnaliticas(): boolean {
  return leerConsentimiento() === 'todo'
}

/** Suscripción para que los consumidores reactionen a un cambio de decisión. */
export function alCambiarConsentimiento(fn: (valor: Consentimiento) => void): () => void {
  const handler = (e: Event) => fn((e as CustomEvent<Consentimiento>).detail ?? null)
  window.addEventListener(EVENTO, handler)
  return () => window.removeEventListener(EVENTO, handler)
}

/** Permite reabrir el aviso desde el footer ("cambiar mis preferencias"). */
export function abrirPreferenciasCookies() {
  window.dispatchEvent(new Event(EVENTO_ABRIR))
}

export function alAbrirPreferencias(fn: () => void): () => void {
  window.addEventListener(EVENTO_ABRIR, fn)
  return () => window.removeEventListener(EVENTO_ABRIR, fn)
}
