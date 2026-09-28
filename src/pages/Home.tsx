import { useProductos } from '../hooks/useProductos'
import { useResumenResenas } from '../hooks/useResumenResenas'
import { useOutfits } from '../hooks/useOutfits'
import { useMasVendidos, useMejorValorados, useDescuentos } from '../hooks/useProductosHome'
import { ProductShelf } from '../components/ProductShelf'
import { OutfitCarousel } from '../components/OutfitCarousel'
import { CommunitySection } from '../components/CommunitySection'
import { ReviewsSection } from '../components/ReviewsSection'
import { CategoryGrid } from '../components/CategoryGrid'
import { BeneficiosSection } from '../components/BeneficiosSection'
import { HeroCarousel } from '../components/HeroCarousel'

export function Home() {
  const { productos: nuevos, loading: loadingNuevos } = useProductos({ limit: 8 })
  const { outfits } = useOutfits()
  const { productos: masVendidos, loading: loadingVendidos } = useMasVendidos(8)
  const { productos: mejorDrop, loading: loadingMejor } = useMejorValorados(4)
  const { productos: ofertas, loading: loadingOfertas } = useDescuentos(8)

  const statsNuevos = useResumenResenas(nuevos).stats
  const statsVendidos = useResumenResenas(masVendidos).stats
  const statsMejor = useResumenResenas(mejorDrop).stats
  const statsOfertas = useResumenResenas(ofertas).stats

  return (
    <div>
      {/* Hero */}
      <HeroCarousel />

      {/* 1. Descuentos de la semana */}
      {(loadingOfertas || ofertas.length > 0) && (
        <ProductShelf
          titulo="Descuentos de la semana"
          subtitulo="Ofertas destacadas"
          productos={ofertas}
          stats={statsOfertas}
          loading={loadingOfertas}
          linkVerTodos="/catalogo?descuentos=1"
        />
      )}

      {/* 2. Nuevo Drop */}
      <ProductShelf
        titulo="Nuevo Drop"
        subtitulo="Recién llegados"
        productos={nuevos}
        stats={statsNuevos}
        loading={loadingNuevos}
        linkVerTodos="/catalogo"
      />

      {/* 3. Más Vendidos */}
      <ProductShelf
        titulo="Más Vendidos"
        subtitulo="Los favoritos de la comunidad"
        productos={masVendidos}
        stats={statsVendidos}
        loading={loadingVendidos}
        linkVerTodos="/catalogo"
      />

      {/* 4. Compra el conjunto */}
      <OutfitCarousel outfits={outfits} />

      {/* 5. Nuestra comunidad */}
      <CommunitySection />

      {/* 6. Mejor Drop */}
      <ProductShelf
        titulo="Mejor Drop"
        subtitulo="Los mejores calificados"
        productos={mejorDrop}
        stats={statsMejor}
        loading={loadingMejor}
        linkVerTodos="/catalogo"
      />

      {/* 7. Reviews / Opiniones */}
      <ReviewsSection />

      {/* 8. Grid de Categorías */}
      <CategoryGrid />

      {/* Beneficios (antes del footer) */}
      <BeneficiosSection />
    </div>
  )
}