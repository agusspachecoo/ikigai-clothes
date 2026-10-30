import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCatalogo } from '../hooks/useCatalogo'
import { useCategorias } from '../hooks/useCategorias'
import { useProductos } from '../hooks/useProductos'
import { useCierreModal } from '../hooks/useCierreModal'
import { useTalles } from '../hooks/useTalles'
import { useCart } from '../context/cart'
import { ProductCard } from '../components/ProductCard'
import { PanelFiltros } from '../components/PanelFiltros'
import {
  FILTROS_INICIALES,
  ORDENES_CATALOGO,
  hayFiltrosActivos,
  tallesDelCatalogo,
  type EstadoFiltros,
} from '../lib/filtros'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { useSeo } from '../hooks/useSeo'

export function Catalogo() {
  useSeo()

  const [searchParams, setSearchParams] = useSearchParams()
  const inicialBuscar = searchParams.get('buscar') ?? ''
  const [ultimoParamBuscar, setUltimoParamBuscar] = useState(inicialBuscar)
  const [busqueda, setBusqueda] = useState(inicialBuscar)

  const slugInicial = searchParams.get('categoria') ?? ''
  const [ultimoSlug, setUltimoSlug] = useState(slugInicial)
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState<string[]>([])

  const descuentosInicial = searchParams.get('descuentos') === '1'
  const [ultimoDesc, setUltimoDesc] = useState(descuentosInicial)
  const [descuentos, setDescuentos] = useState(descuentosInicial)

  const promocionId = searchParams.get('promo') ?? ''
  const [ultimoParamPromo, setUltimoParamPromo] = useState(promocionId)
  const [promocionEnFiltro, setPromocionEnFiltro] = useState(promocionId)

  const [filtros, setFiltros] = useState<EstadoFiltros>(FILTROS_INICIALES)
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [filtroDropdownAbierto, setFiltroDropdownAbierto] = useState(false)
  const filtroRef = useRef<HTMLDivElement>(null)

  const { categorias } = useCategorias()
  const { orden: ordenTalles } = useTalles()
  const { promociones } = useCart()
  useCierreModal(panelAbierto, () => setPanelAbierto(false))

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (filtroRef.current && !filtroRef.current.contains(e.target as Node)) {
        setFiltroDropdownAbierto(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setFiltroDropdownAbierto(false)
    }
    document.addEventListener('mousedown', onClickFuera)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickFuera)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  if (inicialBuscar !== ultimoParamBuscar) {
    setUltimoParamBuscar(inicialBuscar)
    setBusqueda(inicialBuscar)
  }

  if (slugInicial !== ultimoSlug) {
    setUltimoSlug(slugInicial)
    if (descuentosInicial) {
      setCategoriasSeleccionadas([])
    } else if (slugInicial) {
      setCategoriasSeleccionadas([slugInicial])
    } else {
      setCategoriasSeleccionadas([])
    }
  }

  if (descuentosInicial !== ultimoDesc) {
    setUltimoDesc(descuentosInicial)
    setDescuentos(descuentosInicial)
    if (descuentosInicial) {
      setCategoriasSeleccionadas([])
    }
  }

  if (promocionId !== ultimoParamPromo) {
    setUltimoParamPromo(promocionId)
    setPromocionEnFiltro(promocionId)
    if (promocionId) {
      setFiltros(FILTROS_INICIALES)
      setCategoriasSeleccionadas([])
    }
  }

  const categoriaNombre = descuentos ? undefined : categorias.find((c) => categoriasSeleccionadas.includes(c.slug))?.nombre
  const activosFiltro = hayFiltrosActivos(filtros) || categoriasSeleccionadas.length > 0

  const promocion = promocionEnFiltro
    ? promociones.find((promo) => promo.id === promocionEnFiltro) ?? null
    : null
  const productoIds = useMemo(
    () => (promocion ? [...new Set(promocion.grupos.flatMap((grupo) => grupo.producto_ids))] : undefined),
    [promocion],
  )

  const { productos, total, hayMas, loading, cargarMas } = useCatalogo({
    categoria: categoriaNombre,
    categorias: descuentos
      ? []
      : categoriasSeleccionadas
          .map((slug) => categorias.find((c) => c.slug === slug)?.nombre)
          .filter((n): n is string => Boolean(n)),
    buscar: busqueda,
    descuentos,
    orden: filtros.orden,
    talles: filtros.talles,
    precioMin: filtros.precioMin,
    precioMax: filtros.precioMax,
    soloConStock: filtros.soloConStock,
    productoIds: promocion ? productoIds : undefined,
  })

  const { productos: todos } = useProductos({
    categoria: categoriaNombre,
    buscar: busqueda,
    descuentos,
    productoIds: promocion ? productoIds : undefined,
  })

  function toggleCategoria(slug: string) {
    if (descuentos) return
    setCategoriasSeleccionadas((prev) => {
      if (prev.includes(slug)) {
        return prev.filter((s) => s !== slug)
      }
      return [...prev, slug]
    })
  }

  const tallesDisponibles = tallesDelCatalogo(todos, ordenTalles)

  function limpiarBusqueda() {
    setBusqueda('')
    setUltimoParamBuscar('')
    const params = new URLSearchParams(searchParams)
    params.delete('buscar')
    setSearchParams(params, { replace: true })
  }

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-5 py-6">
      <Breadcrumbs
        items={[
          { label: 'Inicio', to: '/' },
          { label: descuentos ? 'Ofertas' : promocion ? 'Promo' : 'Productos' },
        ]}
      />

      {descuentos && (
        <div className="mb-6">
          <h1 className="font-display text-2xl">Ofertas</h1>
          <p className="text-sm opacity-60">Productos con precio promocional activo.</p>
        </div>
      )}

      {!descuentos && promocion && (
        <div className="mb-6">
          <h1 className="font-display text-2xl">{promocion.nombre}</h1>
          <p className="text-sm opacity-60">Productos participantes de la promoción.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-y border-line py-3 mb-6">
        {busqueda && (
          <button
            type="button"
            onClick={limpiarBusqueda}
            className="btn btn-xs btn-outline rounded-none"
          >
            Búsqueda: {busqueda} ×
          </button>
        )}
        <div className="relative min-w-0 ml-auto">
          <select
            aria-label="Ordenar productos"
            className="select select-sm rounded-none max-w-full"
            value={filtros.orden}
            onChange={(e) =>
              setFiltros({ ...filtros, orden: e.target.value as EstadoFiltros['orden'] })
            }
          >
            {ORDENES_CATALOGO.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="relative hidden md:block" ref={filtroRef}>
          <button
            type="button"
            onClick={() => setFiltroDropdownAbierto((v) => !v)}
            className="btn btn-sm btn-outline rounded-none shrink-0"
          >
            Filtrar{activosFiltro ? ' •' : ''}
          </button>
          <div
            className={`absolute right-0 top-full mt-2 w-[320px] max-w-[90vw] bg-base-100 border border-line shadow-xl z-40 ${
              filtroDropdownAbierto ? 'block' : 'hidden'
            }`}
          >
            <div className="p-4">
              <PanelFiltros
                estado={filtros}
                onChange={(estado) => setFiltros(estado)}
                productos={todos}
                total={total}
                totalSinFiltrar={todos.length}
                categorias={categorias}
                categoriaSlug={categoriasSeleccionadas[0] ?? ''}
                onCategoriaChange={(slug) => toggleCategoria(slug)}
                categoriasSeleccionadas={categoriasSeleccionadas}
                onCategoriasChange={setCategoriasSeleccionadas}
                mostrarCategorias={!descuentos}
              />
            </div>
            <div className="border-t border-line p-3">
              <button
                type="button"
                onClick={() => setFiltroDropdownAbierto(false)}
                className="btn btn-outline btn-sm rounded-none w-full"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPanelAbierto(true)}
          className="btn btn-sm btn-outline rounded-none md:hidden shrink-0"
        >
          Filtrar
        </button>
      </div>

      <div>
        <p className="text-xs opacity-60 mb-4">
          {loading
            ? 'Cargando productos...'
            : `${total} ${total === 1 ? 'producto' : 'productos'}`}
          {tallesDisponibles.length > 0 && ` · ${tallesDisponibles.length} talles`}
        </p>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton aspect-[3/4] w-full rounded-none" />
            ))}
          </div>
        ) : productos.length === 0 ? (
          <div className="text-center py-20">
            <p className="opacity-60">No se encontraron productos</p>
            <button
              type="button"
              onClick={() => {
                setFiltros(FILTROS_INICIALES)
                limpiarBusqueda()
              }}
              className="btn btn-outline btn-sm rounded-none mt-4"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {productos.map((p) => (
                <ProductCard key={p.id} producto={p} />
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

      {panelAbierto && (
        <div className="fixed inset-0 z-50">
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
              categorias={categorias}
              categoriaSlug={categoriasSeleccionadas[0] ?? ''}
              onCategoriaChange={(slug) => toggleCategoria(slug)}
              categoriasSeleccionadas={categoriasSeleccionadas}
              onCategoriasChange={setCategoriasSeleccionadas}
              mostrarCategorias={!descuentos}
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
