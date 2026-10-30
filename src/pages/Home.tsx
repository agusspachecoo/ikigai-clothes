import { useOutfits } from '../hooks/useOutfits'
import { useMasVendidos, useDescuentos } from '../hooks/useProductosHome'
import { useDropsDestacados } from '../hooks/useDropsDestacados'
import { ProductShelf } from '../components/ProductShelf'
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

export function Home() {
  useSeo()

  const { outfits } = useOutfits()
  const { productos: masVendidos, loading: loadingVendidos } = useMasVendidos(8)
  const { productos: ofertas, loading: loadingOfertas } = useDescuentos(8)
  const { drops, recargar } = useDropsDestacados()

  return (
    <div>
      <h1 className="sr-only">Ikigai Clothes · Indumentaria urbana en Oberá, Misiones</h1>

      {/* Hero */}
      <HeroCarousel />

      <PromocionBanner />

      {/* Drops / Lanzamientos exclusivos (sección destacada principal) */}
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
