import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { OutfitConItems } from '../types/database'

export function useOutfits() {
  const [outfits, setOutfits] = useState<OutfitConItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchOutfits() {
      setLoading(true)
      const { data, error: err } = await supabase
        .from('outfits')
        .select('*, outfit_items(*, producto:productos(*, variaciones_stock(*)))')
        .eq('activo', true)
        .order('created_at', { ascending: false })

      if (!cancelled) {
        if (err) setError(err.message)
        else setOutfits(data as OutfitConItems[])
        setLoading(false)
      }
    }

    fetchOutfits()
    return () => { cancelled = true }
  }, [])

  return { outfits, loading, error }
}
