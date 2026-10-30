import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { DROP_EMBED, filtrarDropsFuturos } from '../lib/drops'
import type { ProductoConStock } from '../types/database'
import { obtenerUrlImagen } from '../lib/imagenes'
import { formatearPrecio, precioConDescuento } from '../lib/precios'

interface Props {
  className?: string
  placeholder?: string
  onNavegar?: () => void
}

export function Buscador({ className = '', placeholder = 'Buscar prendas...', onNavegar }: Props) {
  const [term, setTerm] = useState('')
  const [sugerencias, setSugerencias] = useState<ProductoConStock[]>([])
  const [abierto, setAbierto] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
  }, [])

  function onChangeTerm(value: string) {
    setTerm(value)

    const texto = value.trim()
    if (timerRef.current) window.clearTimeout(timerRef.current)

    if (!texto) {
      setSugerencias([])
      setLoading(false)
      setAbierto(false)
      return
    }

    setLoading(true)
    timerRef.current = window.setTimeout(async () => {
      const termino = texto.replace(/["'%\\]/g, '')
      const [res, prox] = await Promise.all([
        supabase
          .from('productos')
          .select(`*, variaciones_stock(*), ${DROP_EMBED}`)
          .eq('activo', true)
          .or(`nombre.ilike.%${termino}%,categoria.ilike.%${termino}%`)
          .limit(6),
        supabase.rpc('productos_proximos', { p_buscar: termino || null }),
      ])

      const normales = filtrarDropsFuturos((res.data ?? []) as ProductoConStock[])
      const ocultos = ((prox?.data ?? []) as Omit<ProductoConStock, 'variaciones_stock'>[]).map(
        (p) => ({ ...p, variaciones_stock: [], bloqueado: true }),
      )

      setSugerencias([...normales, ...ocultos].slice(0, 6))
      setLoading(false)
      setAbierto(true)
    }, 250)
  }

  function cerrar() {
    setAbierto(false)
    setTerm('')
    setSugerencias([])
  }

  function irAlCatalogo() {
    const q = term.trim()
    setAbierto(false)
    onNavegar?.()
    navigate(q ? `/catalogo?buscar=${encodeURIComponent(q)}` : '/catalogo')
  }

  function irAlProducto(id: string) {
    cerrar()
    onNavegar?.()
    navigate(`/producto/${id}`)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          irAlCatalogo()
        }}
        className="w-full h-full flex items-center gap-2"
      >
        <input
          type="text"
          aria-label="Buscar productos"
          className="grow outline-none bg-transparent resize-none placeholder:text-current placeholder:opacity-40"
          placeholder={placeholder}
          value={term}
          onChange={(e) => onChangeTerm(e.target.value)}
          onFocus={() => term.trim() && setAbierto(true)}
        />
        {loading && <span className="loading loading-spinner loading-xs text-primary"></span>}
        <svg className="h-4 w-4 opacity-60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
        </svg>
      </form>

      {abierto && sugerencias.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-0 bg-base-100 text-base-content border border-line overflow-hidden z-50 shadow-lg">
          {sugerencias.map((p) => {
            const imgUrl = obtenerUrlImagen(p.imagenes[0])
            return p.bloqueado ? (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="relative h-12 w-10 shrink-0 overflow-hidden bg-base-200">
                  {imgUrl && (
                    <img
                      src={imgUrl}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover scale-110 blur-[3px]"
                      onError={(e) => {
                        ;(e.currentTarget as HTMLElement).style.display = 'none'
                      }}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-base-content/60">Próximamente...</p>
                  <p className="text-xs opacity-50 text-gray-600">{p.categoria}</p>
                </div>
                <span className="shrink-0 text-[10px] uppercase tracking-widest text-base-content/50">
                  Pronto
                </span>
              </div>
            ) : (
              <div key={p.id} className="flex items-center gap-2 pr-3 hover:bg-base-200 transition-colors">
                <button
                  type="button"
                  onClick={() => irAlProducto(p.id)}
                  className="flex-1 min-w-0 flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer"
                >
                  <img
                    src={imgUrl}
                    alt={`${p.nombre}, ${p.categoria}`}
                    loading="lazy"
                    decoding="async"
                    width={40}
                    height={48}
                    className="w-10 h-12 object-cover bg-base-200 shrink-0"
                    onError={(e) => {
                      ;(e.currentTarget as HTMLElement).style.display = 'none'
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.nombre}</p>
                    <p className="text-xs opacity-50 text-gray-600">{p.categoria}</p>
                  </div>
                  <span className="text-sm shrink-0">
                    ${formatearPrecio(precioConDescuento(p.precio, p.discount_percent))}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => irAlProducto(p.id)}
                  className="btn btn-xs btn-neutral shrink-0 cursor-pointer"
                  title={`Ver detalle: ${p.nombre}`}
                >
                  Ver
                </button>
              </div>
            )
          })}
          <button
            type="button"
            onClick={irAlCatalogo}
            className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-base-200 cursor-pointer border-t border-line transition-colors"
          >
            Ver todos los resultados para &quot;{term}&quot;
          </button>
        </div>
      )}

      {abierto && sugerencias.length === 0 && !loading && term.trim() && (
        <div className="absolute left-0 right-0 top-full mt-0 bg-base-100 text-base-content border border-line overflow-hidden z-50">
          <button
            type="button"
            onClick={irAlCatalogo}
            className="w-full text-left px-4 py-3 text-sm font-semibold text-primary hover:bg-base-200 cursor-pointer transition-colors"
          >
            Buscar &quot;{term}&quot; en el catálogo
          </button>
        </div>
      )}
    </div>
  )
}