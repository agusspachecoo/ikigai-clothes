import { useMemo, useState } from 'react'
import { useProductos } from './useProductos'
import { precioConDescuento } from '../lib/precios'
import { stockDeTalle } from '../lib/talles'
import type { OrdenCatalogo } from '../lib/filtros'
import type { ProductoConStock } from '../types/database'

export interface FiltrosCatalogo {
  categoria?: string
  buscar?: string
  descuentos?: boolean
  orden?: OrdenCatalogo
  talles?: string[]
  precioMin?: number | null
  precioMax?: number | null
  soloConStock?: boolean
}

const POR_PAGINA = 12

function precioFinal(p: ProductoConStock) {
  return precioConDescuento(p.precio, p.discount_percent)
}

function ordenar(lista: ProductoConStock[], orden: OrdenCatalogo) {
  const copia = [...lista]
  switch (orden) {
    case 'precio-asc':
      return copia.sort((a, b) => precioFinal(a) - precioFinal(b))
    case 'precio-desc':
      return copia.sort((a, b) => precioFinal(b) - precioFinal(a))
    case 'descuento':
      return copia.sort(
        (a, b) => (b.discount_percent || 0) - (a.discount_percent || 0) || precioFinal(a) - precioFinal(b),
      )
    case 'nombre':
      return copia.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    case 'nuevos':
    default:
      return copia.sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
}

/**
 * Catálogo con filtros y ordenamiento del lado del cliente.
 * El catálogo de una boutique es chico, así que se trae una sola vez y se
 * filtra en memoria: así el filtro por talle (que depende de
 * `variaciones_stock`) y por precio final (con descuento) son exactos.
 */
export function useCatalogo(filtros: FiltrosCatalogo) {
  const { productos, loading, error } = useProductos({
    categoria: filtros.categoria,
    buscar: filtros.buscar,
    descuentos: filtros.descuentos,
  })

  const [visibles, setVisibles] = useState(POR_PAGINA)

  const talles = useMemo(() => filtros.talles ?? [], [filtros.talles])
  const orden = filtros.orden ?? 'nuevos'

  // Al cambiar cualquier filtro se vuelve a la primera página.
  const clave = JSON.stringify([
    filtros.categoria,
    filtros.buscar,
    filtros.descuentos,
    orden,
    talles,
    filtros.precioMin,
    filtros.precioMax,
    filtros.soloConStock,
  ])
  const [ultimaClave, setUltimaClave] = useState(clave)
  if (clave !== ultimaClave) {
    setUltimaClave(clave)
    setVisibles(POR_PAGINA)
  }

  const filtrados = useMemo(() => {
    let lista = productos

    if (filtros.soloConStock) {
      lista = lista.filter(
        (p) =>
          p.variaciones_stock.length === 0 ||
          p.variaciones_stock.some((v) => (v.stock_disponible ?? 0) > 0),
      )
    }

    if (talles.length > 0) {
      lista = lista.filter((p) => talles.some((t) => stockDeTalle(p.variaciones_stock, t) > 0))
    }

    if (filtros.precioMin != null) {
      lista = lista.filter((p) => precioFinal(p) >= filtros.precioMin!)
    }
    if (filtros.precioMax != null) {
      lista = lista.filter((p) => precioFinal(p) <= filtros.precioMax!)
    }

    return ordenar(lista, orden)
  }, [productos, filtros.soloConStock, talles, orden, filtros.precioMin, filtros.precioMax])

  const visiblesEnPantalla = filtrados.slice(0, visibles)
  const hayMas = visiblesEnPantalla.length < filtrados.length

  return {
    productos: visiblesEnPantalla,
    total: filtrados.length,
    hayMas,
    loading,
    error,
    cargarMas: () => setVisibles((v) => v + POR_PAGINA),
  }
}
