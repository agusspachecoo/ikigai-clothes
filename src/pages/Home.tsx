import { Link } from 'react-router-dom'
import { useProductos } from '../hooks/useProductos'
import { useOutfits } from '../hooks/useOutfits'
import { ProductCard } from '../components/ProductCard'
import { OutfitCarousel } from '../components/OutfitCarousel'
import { CommunitySection } from '../components/CommunitySection'
import logo from '../assets/logo-transparent.png'

export function Home() {
  const { productos, loading } = useProductos({ limit: 8 })
  const { outfits } = useOutfits()

  return (
    <div>
      {/* Hero */}
      <section className="relative bg-base-100 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-80 h-80 md:w-96 md:h-96 rounded-full bg-base-300 blur-3xl"></div>
        <div className="absolute -bottom-32 -left-24 w-80 h-80 md:w-96 md:h-96 rounded-full bg-primary/5 blur-3xl"></div>

        <div className="relative max-w-7xl mx-auto px-4 py-20 md:py-28 text-center">
          <p className="text-xs font-semibold tracking-[0.25em] uppercase opacity-60">
            Ropa urbana &amp; deportiva
          </p>
          <img
            src={logo}
            alt="Ikigai Clothes"
            className="mt-4 w-72 md:w-96 max-w-md mx-auto"
          />
          <p className="text-lg md:text-xl opacity-60 mt-6 max-w-md mx-auto">
            Prendas con estilo y actitud para que encuentres tu propia esencia.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/catalogo" className="btn btn-primary btn-lg w-full sm:w-auto">
              Ver Catálogo
            </Link>
            <Link to="/outfits" className="btn btn-outline btn-primary btn-lg w-full sm:w-auto">
              Ver Outfits
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
            <span className="badge badge-outline badge-lg">Envíos a todo el país</span>
            <span className="badge badge-outline badge-lg">Retiro en showroom</span>
          </div>
        </div>
      </section>

      {/* Productos Destacados */}
      <section className="py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-xs font-semibold tracking-[0.25em] uppercase opacity-60 mb-1">
                Nueva temporada
              </p>
              <h2 className="text-2xl md:text-3xl font-bold">Productos Destacados</h2>
            </div>
            <Link to="/catalogo" className="btn btn-outline btn-primary btn-sm md:btn-md">
              Ver todos
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-64 w-full rounded-lg"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {productos.map((p) => (
                <ProductCard key={p.id} producto={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Outfits estilo Moscú */}
      <OutfitCarousel outfits={outfits} />

      {/* Nuestra Comunidad */}
      <CommunitySection />

      {/* Beneficios */}
      <section className="py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="flex items-center gap-4 p-4 rounded-xl bg-base-100 shadow-sm">
            <div className="btn btn-square btn-primary btn-lg btn-outline pointer-events-none">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold">Envíos a todo el país</h3>
              <p className="text-xs opacity-60">Despachamos a cualquier provincia de Argentina.</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-xl bg-base-100 shadow-sm">
            <div className="btn btn-square btn-primary btn-lg btn-outline pointer-events-none">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold">Métodos de pago</h3>
              <p className="text-xs opacity-60">Mercado Pago, tarjetas y transferencia bancaria.</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-xl bg-base-100 shadow-sm">
            <div className="btn btn-square btn-primary btn-lg btn-outline pointer-events-none">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold">Comunidad &amp; reseñas</h3>
              <p className="text-xs opacity-60">Mirá looks reales y opiniones de otros clientes.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}