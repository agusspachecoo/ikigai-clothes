import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCatalogo } from '../hooks/useCatalogo'
import { useResumenResenas } from '../hooks/useResumenResenas'
import { useCategorias } from '../hooks/useCategorias'
import { useProductos } from '../hooks/useProductos'
import { useCierreModal } from '../hooks/useCierreModal'
import { ProductCard } from '../components/ProductCard'
import { PanelFiltros } from '../components/PanelFiltros'
import { FILTROS_INICIALES, tallesDelCatalogo, type EstadoFiltros } from '../lib/filtros'
import { Breadcrumbs } from '../components/Breadcrumbs'

export function Catalogo() {
  const [searchParams] = useSearchParams()
  const inicial = searchParams.get('buscar') ?? ''
  const [ultimoParam, setUltimoParam] = useState(inicial)
  const [buscar, setBuscar] = useState(inicial)
  const [busqueda, setBusqueda] = useState(inicial)

  const slugInicial = searchParams.get('categoria') ?? ''
  const [ultimoSlug, setUltimoSlug] = useState(slugInicial)
  const [categoriaSlug, setCategoriaSlug] = useState(slugInicial)

  const descuentosInicial = searchParams.get('descuentos') === '1'
  const [ultimoDesc, setUltimoDesc] = useState(descuentosInicial)
  const [descuentos, setDescuentos] = useState(descuentosInicial)

  const [filtros, setFiltros] = useState<EstadoFiltros>(FILTROS_INICIALES)
  const [panelAbierto, setPanelAbierto] = useState(false)

  const { categorias } = useCategorias()
  useCierreModal(panelAbierto, () => setPanelAbierto(false))

  if (inicial !== ultimoParam) {
    setUltimoParam(inicial)
    setBuscar(inicial)
    setBusqueda(inicial)
  }

  if (slugInicial !== ultimoSlug) {
    setUltimoSlug(slugInicial)
    setCategoriaSlug(slugInicial)
  }

  if (descuentosInicial !== ultimoDesc) {
    setUltimoDesc(descuentosInicial)
    setDescuentos(descuentosInicial)
  }

  const categoriaNombre = categorias.find((c) => c.slug === categoriaSlug)?.nombre

  const { productos, total, hayMas, loading, cargarMas } = useCatalogo({
    categoria: categoriaNombre,
    buscar: busqueda,
    descuentos,
    orden: filtros.orden,
    talles: filtros.talles,
    precioMin: filtros.precioMin,
    precioMax: filtros.precioMax,
    soloConStock: filtros.soloConStock,
  })

  // El panel necesita el listado completo para ofrecer los talles disponibles.
  const { productos: todos } = useProductos({
    categoria: categoriaNombre,
    buscar: busqueda,
    descuentos,
  })

  const { stats } = useResumenResenas(productos)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setBusqueda(buscar)
  }

  const tallesDisponibles = tallesDelCatalogo(todos)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Breadcrumbs
        items={[
          { label: 'Inicio', to: '/' },
          { label: descuentos ? 'Ofertas' : 'Productos' },
        ]}
      />

      {descuentos && (
        <div className="mb-6">
          <h1 className="font-display text-2xl">Ofertas</h1>
          <p className="text-sm opacity-60">Productos con precio promocional activo.</p>
        </div>
      )}

      {/* Categorías */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          className={`btn btn-xs rounded-none ${
            !categoriaSlug && !descuentos ? 'btn-primary' : 'btn-outline'
          }`}
          onClick={() => {
            setCategoriaSlug('')
            setDescuentos(false)
          }}
        >
          Todos
        </button>
        <button
          className={`btn btn-xs rounded-none ${descuentos ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setDescuentos(true)}
        >
          Ofertas
        </button>
        {categorias.map((cat) => (
          <button
            key={cat.id}
            className={`btn btn-xs rounded-none ${
              categoriaSlug === cat.slug ? 'btn-primary' : 'btn-outline'
            }`}
            onClick={() => setCategoriaSlug(cat.slug)}
          >
            {cat.nombre}
          </button>
        ))}
      </div>

      {/* Orden + filtros mobile */}
      <div className="flex items-center gap-3 border-y border-line py-3 mb-6">
        <div className="relative">
          <select
            aria-label="Ordenar productos"
            className="select select-sm rounded-none"
            value={filtros.orden}
            onChange={(e) =>
              setFiltros({ ...filtros, orden: e.target.value as EstadoFiltros['orden'] })
            }
          >
            <option value="nuevos">Novedades</option>
            <option value="precio-asc">Precio: menor a mayor</option>
            <option value="precio-desc">Precio: mayor a menor</option>
            <option value="descuento">Mayor descuento</option>
            <option value="nombre">Alfabético</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => setPanelAbierto(true)}
          className="btn btn-sm btn-outline rounded-none lg:hidden"
        >
          Filtrar
        </button>

        <form onSubmit={handleSearch} className="ml-auto">
          <input
            type="search"
            className="input input-sm rounded-none w-40 sm:w-56"
            placeholder="Buscar..."
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
        </form>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-8">
        {/* Panel lateral desktop */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <PanelFiltros
              estado={filtros}
              onChange={setFiltros}
              productos={todos}
              total={total}
              totalSinFiltrar={todos.length}
            />
          </div>
        </aside>

        {/* Resultados */}
        <div>
          <p className="text-xs opacity-60 mb-4">
            {loading
              ? 'Cargando productos...'
              : `${total} ${total === 1 ? 'producto' : 'productos'}`}
            {tallesDisponibles.length > 0 && ` · ${tallesDisponibles.length} talles`}
          </p>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton aspect-[3/4] w-full rounded-none" />
              ))}
            </div>
          ) : productos.length === 0 ? (
            <div className="text-center py-20">
              <p className="opacity-60">No se encontraron productos</p>
              <button
                type="button"
                onClick={() => setFiltros(FILTROS_INICIALES)}
                className="btn btn-outline btn-sm rounded-none mt-4"
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {productos.map((p) => (
                  <ProductCard key={p.id} producto={p} rating={stats[p.id]} />
                ))}
              </div>

              {hayMas && (
                <div className="text-center mt-10">
                  <button
                    type="button"
                    onClick={cargarMas}
                    className="btn btn-outline rounded-none px-10"
                  >
                    Cargar más
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Panel de filtros mobile */}
      {panelAbierto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPanelAbierto(false)} />
          <aside className="absolute inset-y-0 right-0 w-80 max-w-[88vw] bg-base-100 border-l border-line p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm uppercase tracking-widest">Filtrar</span>
              <button
                type="button"
                onClick={() => setPanelAbierto(false)}
                className="text-xs underline opacity-70"
              >
                Listo
              </button>
            </div>
            <PanelFiltros
              estado={filtros}
              onChange={setFiltros}
              productos={todos}
              total={total}
              totalSinFiltrar={todos.length}
            />
            <button
              type="button"
              onClick={() => setPanelAbierto(false)}
              className="btn btn-primary btn-sm rounded-none w-full mt-6"
            >
              Ver {total} productos
            </button>
          </aside>
        </div>
      )}
    </div>
  )
}
