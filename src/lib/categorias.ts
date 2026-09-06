import { supabase } from './supabase'
import type { Categoria } from '../types/database'

export const CATEGORIAS_FALLBACK = ['Remeras', 'Buzos', 'Pantalones', 'Accesorios']

export function slugify(nombre: string) {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function getCategorias(): Promise<Categoria[]> {
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .order('nombre', { ascending: true })

  if (error) return []
  return (data ?? []) as Categoria[]
}

export function categoriasConFallback(cats: Categoria[]): Categoria[] {
  if (cats.length > 0) return cats
  return CATEGORIAS_FALLBACK.map((nombre) => ({
    id: `fallback-${nombre}`,
    nombre,
    slug: slugify(nombre),
    created_at: '',
  }))
}