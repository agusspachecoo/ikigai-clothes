import { useMemo, useState } from 'react'
import { useProductos } from './useProductos'
import { precioConDescuento } from '../lib/precios'
import { stockDeTalle, tieneStock } from '../lib/talles'
import type { OrdenCatalogo } from '../lib/filtros'
import type { ProductoConStock } from '../types/database'

export interface FiltrosCatalogo {
  categoria?: string
  categorias?: string[]
  buscar?: string
  descuentos?: boolean
  orden?: OrdenCatalogo
  talles?: string[]
  precioMin?: number | null
  precioMax?: number | null
  soloConStock?: boolean
  productoIds?: string[]
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
 */
export function useCatalogo(filtros: FiltrosCatalogo) {
  const { productos, loading, error } = useProductos({
    categoria: filtros.categoria,
    buscar: filtros.buscar,
    descuentos: filtros.descuentos,
    productoIds: filtros.productoIds,
  })

  const [visibles, setVisibles] = useState(POR_PAGINA)

  const talles = useMemo(() => filtros.talles ?? [], [filtros.talles])
  const categoriasSel = useMemo(() => filtros.categorias ?? [], [filtros.categorias])
  const orden = filtros.orden ?? 'nuevos'

  const clave = JSON.stringify([
    filtros.categoria,
    categoriasSel,
    filtros.buscar,
    filtros.descuentos,
    orden,
    talles,
    filtros.precioMin,
    filtros.precioMax,
    filtros.soloConStock,
    filtros.productoIds,
  ])
  const [ultimaClave, setUltimaClave] = useState(clave)
  if (clave !== ultimaClave) {
    setUltimaClave(clave)
    setVisibles(POR_PAGINA)
  }

  const filtrados = useMemo(() => {
    const bloqueados = productos.filter((p) => p.bloqueado)
    let lista = productos.filter((p) => !p.bloqueado)

    if (filtros.productoIds && filtros.productoIds.length > 0) {
      const ids = new Set(filtros.productoIds)
      lista = lista.filter((p) => ids.has(p.id))
    } else if (categoriasSel.length > 0) {
      lista = lista.filter((p) => categoriasSel.includes(p.categoria))
    } else if (filtros.categoria) {
      lista = lista.filter((p) => p.categoria === filtros.categoria)
    }

    if (filtros.soloConStock) {
      lista = lista.filter((p) => tieneStock(p.variaciones_stock))
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

    const conStock = lista.filter((p) => tieneStock(p.variaciones_stock))
    const sinStock = lista.filter((p) => !tieneStock(p.variaciones_stock))
    const ordenados = [...ordenar(conStock, orden), ...ordenar(sinStock, orden)]

    return [...ordenados, ...bloqueados]
  }, [productos, filtros.soloConStock, talles, categoriasSel, filtros.categoria, orden, filtros.precioMin, filtros.precioMax, filtros.productoIds])

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
