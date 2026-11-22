import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { ProductCard } from '../components/ProductCard'
import { useCart } from '../context/cart'
import { useCatalogo } from '../hooks/useCatalogo'
import { useSeo } from '../hooks/useSeo'
import { ORDENES_CATALOGO, type OrdenCatalogo } from '../lib/filtros'
import { formatearPrecio } from '../lib/precios'
import { esPromocionVigente, type Promocion } from '../lib/promociones'

function resumenPromocion(promo: Promocion): string {
  const unidades = promo.grupos[0]?.cantidad_requerida ?? 2
  if (promo.tipo === 'pack') {
    return promo.precio_fijo
      ? `Llevá ${unidades} unidades por $${formatearPrecio(promo.precio_fijo)}`
      : `Llevá ${unidades} unidades con beneficio`
  }
  return `${promo.descuento_porcentaje ?? 0}% OFF en carrito · Llevá ${unidades} prendas`
}

export function Ofertas() {
  useSeo()

  const [searchParams, setSearchParams] = useSearchParams()
  const promoId = searchParams.get('promo') ?? ''
  const [orden, setOrden] = useState<OrdenCatalogo>('descuento')

  const { promociones } = useCart()
  const vigentes = useMemo(
    () => promociones.filter((promo) => esPromocionVigente(promo)),
    [promociones],
  )
  const promoSeleccionada = vigentes.find((promo) => promo.id === promoId) ?? null

  const productoIds = useMemo(
    () =>
      promoSeleccionada
        ? [...new Set(promoSeleccionada.grupos.flatMap((grupo) => grupo.producto_ids))]
        : undefined,
    [promoSeleccionada],
  )

  const { productos, total, hayMas, loading, cargarMas } = useCatalogo({
    descuentos: !promoSeleccionada,
    productoIds,
    orden,
  })

  function seleccionarPromo(id: string) {
    const params = new URLSearchParams(searchParams)
    if (promoId === id) params.delete('promo')
    else params.set('promo', id)
    setSearchParams(params)
  }

  function limpiarPromo() {
    const params = new URLSearchParams(searchParams)
    params.delete('promo')
    setSearchParams(params, { replace: true })
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Ofertas' }]} />

      <header className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <span className="inline-block text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-800">
            Precios especiales
          </span>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-neutral-900 md:text-4xl">
            Ofertas y promociones
          </h1>
          <p className="max-w-2xl text-sm text-neutral-600">
            Prendas con descuento aplicado y combos vigentes. Los beneficios de packs se descuentan
            automáticamente al agregar las prendas al carrito.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="orden-ofertas" className="text-xs font-bold uppercase tracking-wider text-neutral-700">
            Ordenar
          </label>
          <select
            id="orden-ofertas"
            className="select select-bordered rounded-lg text-sm"
            value={orden}
            onChange={(e) => setOrden(e.target.value as OrdenCatalogo)}
          >
            {ORDENES_CATALOGO.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section aria-labelledby="promos-vigentes" className="mb-12">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="promos-vigentes" className="text-lg font-extrabold uppercase tracking-wide text-neutral-900">
            Promociones vigentes
          </h2>
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            {vigentes.length} {vigentes.length === 1 ? 'activa' : 'activas'}
          </span>
        </div>

        {vigentes.length === 0 ? (
          <div className="border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center">
            <p className="text-sm font-bold text-neutral-800">No hay promociones activas en este momento.</p>
            <p className="mt-1 text-xs text-neutral-600">
              Igualmente podés ver las prendas con descuento en la sección siguiente.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vigentes.map((promo) => {
              const seleccionada = promoSeleccionada?.id === promo.id
              return (
                <article
                  key={promo.id}
                  className={`flex h-full flex-col justify-between gap-4 rounded-xl border p-4 transition-colors ${
                    seleccionada
                      ? 'border-emerald-700 bg-emerald-50'
                      : 'border-neutral-300 bg-white hover:border-neutral-900'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="badge badge-sm badge-outline text-[10px] uppercase tracking-wider">
                        {promo.tipo === 'pack' ? 'Pack' : 'Combo'}
                      </span>
                      {promo.prioridad > 0 && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                          Prioridad {promo.prioridad}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold leading-tight text-neutral-900">{promo.nombre}</h3>
                    {promo.descripcion && (
                      <p className="text-sm text-neutral-600">{promo.descripcion}</p>
                    )}
                    <p className="text-sm font-bold text-emerald-800">{resumenPromocion(promo)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => seleccionarPromo(promo.id)}
                    className={`btn btn-sm rounded-none ${seleccionada ? 'btn-outline' : 'btn-neutral text-white'}`}
                  >
                    {seleccionada ? 'Quitar filtro' : 'Ver productos'}
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="productos-oferta">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="productos-oferta" className="text-lg font-extrabold uppercase tracking-wide text-neutral-900">
              {promoSeleccionada ? `Productos de ${promoSeleccionada.nombre}` : 'Prendas con descuento'}
            </h2>
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              {loading ? 'Cargando…' : `${total} ${total === 1 ? 'producto' : 'productos'}`}
            </p>
          </div>
          {promoSeleccionada && (
            <button type="button" onClick={limpiarPromo} className="btn btn-outline btn-sm rounded-none">
              Ver todas las ofertas
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse bg-neutral-100" />
            ))}
          </div>
        ) : productos.length === 0 ? (
          <div className="border border-dashed border-neutral-300 bg-neutral-50 px-6 py-16 text-center">
            <p className="font-bold text-neutral-900">
              {promoSeleccionada
                ? 'Esta promoción todavía no tiene productos visibles.'
                : 'Hoy no hay productos con descuento cargados.'}
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              Volvé a consultar pronto o recorré el catálogo completo.
            </p>
            <Link
              to={promoSeleccionada ? '/ofertas' : '/catalogo'}
              className="btn btn-outline btn-sm rounded-none mt-5"
            >
              {promoSeleccionada ? 'Ver todas las ofertas' : 'Ver el catálogo completo'}
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
              {productos.map((producto) => (
                <ProductCard key={producto.id} producto={producto} />
              ))}
            </div>
            {hayMas && (
              <div className="mt-10 flex justify-center">
                <button type="button" onClick={cargarMas} className="btn btn-outline rounded-none px-10">
                  Cargar más ofertas
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  )
}
