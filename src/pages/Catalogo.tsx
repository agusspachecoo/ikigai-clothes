import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProductos } from '../hooks/useProductos'
import { useCategorias } from '../hooks/useCategorias'
import { ProductCard } from '../components/ProductCard'

export function Catalogo() {
  const [searchParams] = useSearchParams()
  const inicial = searchParams.get('buscar') ?? ''
  const [ultimoParam, setUltimoParam] = useState(inicial)
  const [buscar, setBuscar] = useState(inicial)
  const [busqueda, setBusqueda] = useState(inicial)

  const slugInicial = searchParams.get('categoria') ?? ''
  const [ultimoSlug, setUltimoSlug] = useState(slugInicial)
  const [categoriaSlug, setCategoriaSlug] = useState(slugInicial)

  const { categorias } = useCategorias()

  if (inicial !== ultimoParam) {
    setUltimoParam(inicial)
    setBuscar(inicial)
    setBusqueda(inicial)
  }

  if (slugInicial !== ultimoSlug) {
    setUltimoSlug(slugInicial)
    setCategoriaSlug(slugInicial)
  }

  const categoriaNombre = categorias.find((c) => c.slug === categoriaSlug)?.nombre

  const { productos, loading, total } = useProductos({
    categoria: categoriaNombre,
    buscar: busqueda,
  })

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setBusqueda(buscar)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <button
          className={`btn btn-sm ${!categoriaSlug ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setCategoriaSlug('')}
        >
          Todos
        </button>
        {categorias.map((cat) => (
          <button
            key={cat.id}
            className={`btn btn-sm ${categoriaSlug === cat.slug ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setCategoriaSlug(cat.slug)}
          >
            {cat.nombre}
          </button>
        ))}

        <form onSubmit={handleSearch} className="ml-auto">
          <label className="input input-bordered input-sm flex items-center gap-2">
            <svg className="h-4 w-4 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="search"
              className="grow"
              placeholder="Buscar..."
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
            />
          </label>
        </form>
      </div>

      <p className="text-sm opacity-60 mb-4">{total} productos</p>

      {/* Grid de productos */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-64 w-full rounded-lg"></div>
          ))}
        </div>
      ) : productos.length === 0 ? (
        <div className="text-center py-16">
          <p className="opacity-60">No se encontraron productos</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {productos.map((p) => (
            <ProductCard key={p.id} producto={p} />
          ))}
        </div>
      )}
    </div>
  )
}