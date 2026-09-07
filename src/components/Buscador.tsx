import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { ProductoConStock } from '../types/database'
import { imagenProducto } from '../lib/imagenes'

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
      const { data } = await supabase
        .from('productos')
        .select('*, variaciones_stock(*)')
        .eq('activo', true)
        .or(`nombre.ilike.%${termino}%,categoria.ilike.%${termino}%`)
        .limit(6)

      setSugerencias((data ?? []) as ProductoConStock[])
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
        <svg className="h-4 w-4 opacity-50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="search"
          className="grow outline-none bg-transparent"
          placeholder={placeholder}
          value={term}
          onChange={(e) => onChangeTerm(e.target.value)}
          onFocus={() => term.trim() && setAbierto(true)}
        />
        {loading && <span className="loading loading-spinner loading-xs text-primary"></span>}
      </form>

      {abierto && sugerencias.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 rounded-xl bg-white text-gray-900 border border-base-300 shadow-xl overflow-hidden z-50">
          {sugerencias.map((p, i) => (
            <button
              key={p.id}
              onClick={() => irAlProducto(p.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-gray-900 hover:bg-base-200 cursor-pointer transition-colors"
            >
              <img
                src={imagenProducto(p.imagenes[0], i)}
                alt=""
                className="w-10 h-12 object-cover rounded-lg bg-base-300 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{p.nombre}</p>
                <p className="text-xs opacity-50 text-gray-600">{p.categoria}</p>
              </div>
              <span className="text-sm font-bold shrink-0">
                ${p.precio.toLocaleString('es-AR')}
              </span>
            </button>
          ))}
          <button
            onClick={irAlCatalogo}
            className="w-full text-left px-4 py-3 text-sm font-semibold text-primary hover:bg-base-200 cursor-pointer border-t border-base-300 transition-colors"
          >
            Ver todos los resultados para &quot;{term}&quot;
          </button>
        </div>
      )}

      {abierto && sugerencias.length === 0 && !loading && term.trim() && (
        <div className="absolute left-0 right-0 top-full mt-2 rounded-xl bg-white text-gray-900 border border-base-300 shadow-xl overflow-hidden z-50">
          <button
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