import { Link } from 'react-router-dom'

const BLOQUES = [
  {
    titulo: 'PANTALONES',
    link: '/categoria/pantalones',
    imagen:
      'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?q=80&w=900&auto=format&fit=crop',
    seed: 'categoria-pantalones',
  },
  {
    titulo: 'REMERAS',
    link: '/categoria/remeras',
    imagen:
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=900&auto=format&fit=crop',
    seed: 'categoria-remeras',
  },
  {
    titulo: 'HOODIES',
    link: '/categoria/hoodies',
    imagen:
      'https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=900&auto=format&fit=crop',
    seed: 'categoria-hoodies',
  },
  {
    titulo: 'TODOS LOS PRODUCTOS',
    link: '/productos',
    imagen:
      'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=900&auto=format&fit=crop',
    seed: 'categoria-todos',
  },
]

export function CategoryGrid() {
  return (
    <section className="py-12 md:py-16 bg-white border-t border-base-300">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-8 md:mb-10">
          <p className="text-xs font-semibold tracking-[0.25em] uppercase opacity-60 mb-1">
            Explorá la tienda
          </p>
          <h2 className="text-2xl md:text-4xl font-bold">Categorías</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-5">
          {BLOQUES.map((b) => (
            <Link
              key={b.titulo}
              to={b.link}
              className="group relative block aspect-[16/10] sm:aspect-[3/3] md:aspect-[4/3] overflow-hidden rounded-sm bg-white transition-shadow border border-base-300/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
            >
              <img
                src={b.imagen}
                alt={b.titulo}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  const img = e.currentTarget
                  if (!img.dataset.fallback) {
                    img.dataset.fallback = '1'
                    img.src = `https://picsum.photos/seed/${b.seed}/600/600`
                  }
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/25 to-transparent" />

              <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
                <span className="block h-1 w-8 bg-red-600 mb-2 md:mb-3 transition-all duration-300 group-hover:w-14" />
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tight leading-none text-black">
                  {b.titulo}
                </h3>
                <span className="inline-flex items-center gap-1.5 mt-2 md:mt-3 text-xs md:text-sm font-bold uppercase tracking-wider text-red-600">
                  Ver más
                  <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}