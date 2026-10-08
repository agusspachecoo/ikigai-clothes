import { useProductos } from '../hooks/useProductos'
import { useOutfits } from '../hooks/useOutfits'
import { useMasVendidos, useDescuentos } from '../hooks/useProductosHome'
import { ProductShelf } from '../components/ProductShelf'
import { OutfitCarousel } from '../components/OutfitCarousel'
import { CommunitySection } from '../components/CommunitySection'
import { ReviewsSection } from '../components/ReviewsSection'
import { CategoryGrid } from '../components/CategoryGrid'
import { BeneficiosSection } from '../components/BeneficiosSection'
import { ShowroomSection } from '../components/ShowroomSection'
import { HeroCarousel } from '../components/HeroCarousel'
import { useSeo } from '../hooks/useSeo'

export function Home() {
  useSeo()

  const { productos: nuevos, loading: loadingNuevos } = useProductos({ limit: 8 })
  const { outfits } = useOutfits()
  const { productos: masVendidos, loading: loadingVendidos } = useMasVendidos(8)
  const { productos: ofertas, loading: loadingOfertas } = useDescuentos(8)

  return (
    <div>
      {/* Único h1 de la home: el resto de secciones usan h2. */}
      <h1 className="sr-only">Ikigai Clothes · Indumentaria urbana en Oberá, Misiones</h1>

      {/* Hero */}
      <HeroCarousel />

      {/* 1. Descuentos de la semana */}
      {(loadingOfertas || ofertas.length > 0) && (
        <ProductShelf
          titulo="Descuentos de la semana"
          subtitulo="Ofertas destacadas"
          productos={ofertas}
          loading={loadingOfertas}
          linkVerTodos="/catalogo?descuentos=1"
        />
      )}

      {/* 2. Nuevo Drop */}
      <ProductShelf
        titulo="Nuevo Drop"
        subtitulo="Recién llegados"
        productos={nuevos}
        loading={loadingNuevos}
        linkVerTodos="/catalogo"
      />

      {/* 3. Más Vendidos */}
      <ProductShelf
        titulo="Más Vendidos"
        subtitulo="Los favoritos de la comunidad"
        productos={masVendidos}
        loading={loadingVendidos}
        linkVerTodos="/catalogo"
      />

      {/* 4. Compra el conjunto */}
      <OutfitCarousel outfits={outfits} />

      {/* 5. Nuestra comunidad */}
      <CommunitySection />

      {/* 6. Reviews / Opiniones */}
      <ReviewsSection />

      {/* 7. Grid de Categorías */}
      <CategoryGrid />

      {/* Showroom */}
      <ShowroomSection />

      {/* Beneficios / logística (cierre, antes del footer) */}
      <BeneficiosSection />
    </div>
  )
}