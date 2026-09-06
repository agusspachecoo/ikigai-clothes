export const IMAGENES_FALLBACK = [
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab',
  'https://images.unsplash.com/photo-1509631179647-0177331693ae',
  'https://images.unsplash.com/photo-1496747611176-843222e1e57c',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1',
  'https://images.unsplash.com/photo-1469334031218-e382a71b716b',
  'https://images.unsplash.com/photo-1445205170230-053b83016050',
  'https://images.unsplash.com/photo-1423655156442-ccc11daa4e99',
]

function conParams(url: string) {
  return `${url}?q=80&w=600&auto=format&fit=crop`
}

export function imagenOutfit(url: string | null | undefined, indice = 0): string {
  if (url) return url
  return conParams(IMAGENES_FALLBACK[indice % IMAGENES_FALLBACK.length])
}

export function imagenProducto(url: string | null | undefined, indice = 0): string {
  if (url) return url
  return conParams(IMAGENES_FALLBACK[(indice + 2) % IMAGENES_FALLBACK.length])
}