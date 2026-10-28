import { formatearPrecio } from '../lib/precios'
import { FILTROS_INICIALES, hayFiltrosActivos, type EstadoFiltros } from '../lib/filtros'
import type { ProductoConStock } from '../types/database'
import type { Categoria } from '../types/database'

interface Props {
  estado: EstadoFiltros
  onChange: (estado: EstadoFiltros) => void
  productos: ProductoConStock[]
  total: number
  totalSinFiltrar: number
  categorias?: Categoria[]
  categoriaSlug?: string
  onCategoriaChange?: (slug: string) => void
  categoriasSeleccionadas?: string[]
  onCategoriasChange?: (slugs: string[]) => void
  mostrarCategorias?: boolean
}

export function PanelFiltros({
  estado,
  onChange,
  productos,
  total,
  totalSinFiltrar,
  categorias = [],
  categoriaSlug = '',
  onCategoriaChange,
  categoriasSeleccionadas = [],
  onCategoriasChange,
  mostrarCategorias = false,
}: Props) {
  const activos = hayFiltrosActivos(estado)

  function alternarTalle(talle: string) {
    onChange({
      ...estado,
      talles: estado.talles.includes(talle)
        ? estado.talles.filter((t) => t !== talle)
        : [...estado.talles, talle],
    })
  }

  const talles = new Set<string>()
  for (const p of productos) {
    for (const v of p.variaciones_stock) {
      if ((v.stock_disponible ?? 0) > 0) {
        talles.add(v.talle)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm uppercase tracking-widest">Filtrar</h2>
        {activos && (
          <button
            type="button"
            onClick={() => onChange({ ...FILTROS_INICIALES, orden: estado.orden })}
            className="text-xs underline opacity-70 hover:opacity-100"
          >
            Limpiar
          </button>
        )}
      </div>

      {mostrarCategorias && categorias.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-widest opacity-50 mb-2">Categorías</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (onCategoriasChange) onCategoriasChange([])
                else onCategoriaChange?.('')
              }}
              className={`btn btn-xs rounded-none ${
                categoriasSeleccionadas.length === 0 && !categoriaSlug
                  ? 'btn-primary'
                  : 'btn-outline'
              }`}
            >
              Todos
            </button>
            {categorias.map((cat) => {
              const activa = categoriasSeleccionadas.includes(cat.slug) || categoriaSlug === cat.slug
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    if (onCategoriasChange) {
                      if (categoriasSeleccionadas.includes(cat.slug)) {
                        onCategoriasChange(categoriasSeleccionadas.filter((s) => s !== cat.slug))
                      } else {
                        onCategoriasChange([...categoriasSeleccionadas, cat.slug])
                      }
                    } else {
                      onCategoriaChange?.(cat.slug)
                    }
                  }}
                  className={`btn btn-xs rounded-none ${activa ? 'btn-primary' : 'btn-outline'}`}
                >
                  {cat.nombre}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {talles.size > 0 && (
        <div>
          <p className="text-xs uppercase tracking-widest opacity-50 mb-2">Talle</p>
          <div className="flex flex-wrap gap-2">
            {[...talles].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => alternarTalle(t)}
                aria-pressed={estado.talles.includes(t)}
                className={`min-w-10 h-9 px-2 border text-xs transition-colors ${
                  estado.talles.includes(t)
                    ? 'bg-neutral text-neutral-content border-neutral'
                    : 'border-line hover:border-neutral'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs uppercase tracking-widest opacity-50 mb-2">Precio</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Mín."
            aria-label="Precio mínimo"
            value={estado.precioMin ?? ''}
            onChange={(e) =>
              onChange({
                ...estado,
                precioMin: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            className="input input-sm w-full rounded-none"
          />
          <span className="opacity-40 text-xs">a</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="Máx."
            aria-label="Precio máximo"
            value={estado.precioMax ?? ''}
            onChange={(e) =>
              onChange({
                ...estado,
                precioMax: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            className="input input-sm w-full rounded-none"
          />
        </div>
        <p className="text-xs opacity-50 mt-2">
          {formatearPrecio(estado.precioMin ?? 0)} — {formatearPrecio(estado.precioMax ?? 0)}
        </p>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="checkbox checkbox-xs"
            checked={estado.soloConStock}
            onChange={(e) => onChange({ ...estado, soloConStock: e.target.checked })}
          />
          Solo productos con stock
        </label>
      </div>

      <p className="text-xs opacity-60 border-t border-line pt-3">
        {total} de {totalSinFiltrar} productos
      </p>
    </div>
  )
}
