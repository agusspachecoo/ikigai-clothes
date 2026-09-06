import { useState, useEffect } from 'react'
import { getCategorias, categoriasConFallback } from '../lib/categorias'
import type { Categoria } from '../types/database'

export function useCategorias() {
  const [categorias, setCategorias] = useState<Categoria[]>(() => categoriasConFallback([]))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let activo = true

    async function cargar() {
      setLoading(true)
      const cats = await getCategorias()
      if (activo) {
        setCategorias(categoriasConFallback(cats))
        setLoading(false)
      }
    }

    cargar()
    return () => { activo = false }
  }, [])

  return { categorias, loading }
}