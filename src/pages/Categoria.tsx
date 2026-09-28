import { Navigate, useParams } from 'react-router-dom'
import { slugify } from '../lib/categorias'

const ALIASES: Record<string, string> = {
  remeras: 'remeras',
  remera: 'remeras',
  pantalones: 'pantalones',
  pantalon: 'pantalones',
  hoodies: 'buzos',
  hoodie: 'buzos',
  buzos: 'buzos',
  accesorios: 'accesorios',
}

export function Categoria() {
  const { slug = '' } = useParams<{ slug: string }>()
  const canonical = ALIASES[slug.toLowerCase()] ?? slugify(slug)

  return <Navigate to={`/catalogo?categoria=${canonical}`} replace />
}