import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useOutfits } from '../hooks/useOutfits'
import { useMasVendidos, useDescuentos } from '../hooks/useProductosHome'
import { useProductos } from '../hooks/useProductos'
import { useDropsDestacados } from '../hooks/useDropsDestacados'
import { ProductShelf } from '../components/ProductShelf'
import { ProductGrid } from '../components/ProductGrid'
import { DropSection } from '../components/DropSection'
import { OutfitCarousel } from '../components/OutfitCarousel'
import { CommunitySection } from '../components/CommunitySection'
import { ReviewsSection } from '../components/ReviewsSection'
import { CategoryGrid } from '../components/CategoryGrid'
import { BeneficiosSection } from '../components/BeneficiosSection'
import { ShowroomSection } from '../components/ShowroomSection'
import { HeroCarousel } from '../components/HeroCarousel'
import { PromocionBanner } from '../components/PromocionBanner'
import { useSeo } from '../hooks/useSeo'

const LIMITE_ULTIMOS = 10
// Se piden más productos de los que se muestran para poder descartar los que
// ya aparecen en Ofertas, Más Vendidos o en el drop y aun así completar 10.
const LIMITE_CONSULTA_ULTIMOS = 40

export function Home() {
  useSeo()

  const { outfits } = useOutfits()
  const { productos: masVendidos, loading: loadingVendidos } = useMasVendidos(8)
  const { productos: ofertas, loading: loadingOfertas } = useDescuentos(8)
  const { productos: recientes, loading: loadingRecientes } = useProductos({
    limit: LIMITE_CONSULTA_ULTIMOS,
  })
  const { drops, recargar } = useDropsDestacados()

  const idsExcluidos = useMemo(
    () =>
      new Set([
        ...ofertas.map((p) => p.id),
        ...masVendidos.map((p) => p.id),
        ...drops.flatMap((vista) => vista.productos.map((p) => p.id)),
      ]),
    [ofertas, masVendidos, drops],
  )

  const ultimosIngresos = useMemo(
    () =>
      recientes
        .filter((p) => !p.bloqueado && !idsExcluidos.has(p.id))
        .slice(0, LIMITE_ULTIMOS),
    [recientes, idsExcluidos],
  )

  const loadingUltimos = loadingRecientes || loadingOfertas || loadingVendidos

  return (
    <div>
      <h1 className="sr-only">Ikigai Clothes · Indumentaria urbana en Oberá, Misiones</h1>

      {/* Hero */}
      <HeroCarousel />

      <PromocionBanner />

      {/* Nuevo Drop (solo drops activos o próximos con productos) */}
      {drops.map((vista) => (
        <DropSection key={vista.drop.id} vista={vista} onRevelar={recargar} />
      ))}

      {/* Descuentos de la semana */}
      {(loadingOfertas || ofertas.length > 0) && (
        <ProductShelf
          titulo="Descuentos de la semana"
          subtitulo="Ofertas destacadas"
          productos={ofertas}
          loading={loadingOfertas}
          linkVerTodos="/catalogo?descuentos=1"
        />
      )}

      {/* Más Vendidos */}
      <ProductShelf
        titulo="Más Vendidos"
        subtitulo="Los favoritos de la comunidad"
        productos={masVendidos}
        loading={loadingVendidos}
        linkVerTodos="/catalogo"
      />

      {/* Últimos ingresos (grilla estática, sin repetir productos de arriba) */}
      {(loadingUltimos || ultimosIngresos.length > 0) && (
        <section className="py-12 md:py-16 w-full">
          {/* Mismo contenedor que el catálogo para que las tarjetas midan igual */}
          <div className="max-w-[1600px] mx-auto px-3 sm:px-5">
            <div className="flex items-end justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-semibold tracking-[0.25em] uppercase opacity-60 mb-1">
                  Recién llegados
                </p>
                <h2 className="text-2xl md:text-3xl font-bold">Últimos ingresos</h2>
              </div>

              <Link
                to="/catalogo"
                className="shrink-0 btn btn-outline btn-primary btn-sm md:btn-md"
              >
                Ver todos
              </Link>
            </div>

            <ProductGrid productos={ultimosIngresos} loading={loadingUltimos} />
          </div>
        </section>
      )}

      {/* Compra el conjunto */}
      <OutfitCarousel outfits={outfits} />

      {/* Nuestra comunidad */}
      <CommunitySection />

      {/* Reviews / Opiniones */}
      <ReviewsSection />

      {/* Grid de Categorías */}
      <CategoryGrid />

      {/* Showroom */}
      <ShowroomSection />

      {/* Beneficios / logística (cierre, antes del footer) */}
      <BeneficiosSection />
    </div>
  )
}
