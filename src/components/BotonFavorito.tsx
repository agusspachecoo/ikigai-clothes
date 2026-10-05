import { useAuth } from '../context/auth'
import { useFavoritos } from '../context/favoritos'

/**
 * Corazón de wishlist para las tarjetas de producto.
 *
 * Sin sesión no se puede guardar (la tabla tiene RLS por `auth.uid()`), así que
 * abre el modal de login en vez de fallar en silencio.
 */
export function BotonFavorito({
  productoId,
  className = '',
}: {
  productoId: string
  className?: string
}) {
  const { user, abrirAuthModal } = useAuth()
  const { esFavorito, alternar } = useFavoritos()
  const activo = esFavorito(productoId)

  async function onClick() {
    if (!user) {
      abrirAuthModal()
      return
    }
    await alternar(productoId)
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={activo ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      aria-pressed={activo}
      title={activo ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      className={`shrink-0 transition-colors ${
        activo ? 'text-error' : 'text-zinc-400 hover:text-error'
      } ${className}`}
    >
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill={activo ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>
    </button>
  )
}
