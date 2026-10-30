import { Link } from 'react-router-dom'
import { useCart } from '../context/cart'
import { promocionDestacada, type ItemPromocion } from '../lib/promociones'

export function PromocionBanner() {
  const { promociones, items } = useCart()
  const promocion = promocionDestacada(promociones, items as ItemPromocion[]) ?? null

  if (!promocion) return null

  const titulo = promocion.descripcion?.trim() || promocion.nombre.trim()
  const cantidad = promocion.grupos[0]?.cantidad_requerida ?? 2
  const porcentaje = promocion.descuento_porcentaje ?? 0

  const subtitulo =
    promocion.tipo === 'pack'
      ? `Pack exclusivo · Llevá ${cantidad} unidades con beneficio`
      : `Combo especial · ${porcentaje}% OFF aplicado en carrito`

  const href = `/catalogo?promo=${promocion.id}`

  return (
    <section className="w-full bg-base-100 py-4 md:py-6" aria-labelledby="promocion-banner-titulo">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-neutral via-neutral/95 to-neutral-800 text-neutral-content shadow-xl border border-white/10 px-6 py-8 md:px-10 md:py-10">

          <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-white/5 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-white/10 text-white backdrop-blur-sm border border-white/10">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                Promoción Activa
              </span>

              <h2 id="promocion-banner-titulo" className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                {titulo}
              </h2>

              <p className="text-sm md:text-base text-neutral-content/80 font-medium">
                {subtitulo}
              </p>
            </div>

            <div className="flex items-center sm:self-center">
              <Link
                to={href}
                className="btn btn-md md:btn-lg rounded-xl bg-white text-neutral hover:bg-neutral-100 border-0 shadow-lg font-semibold px-8 transition-transform duration-200 hover:scale-105"
              >
                Ver productos
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
