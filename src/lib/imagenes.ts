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

/**
 * Transformación de imágenes de Supabase Storage.
 *
 * Las URLs del bucket vienen como `/storage/v1/object/public/...`. La ruta
 * `/storage/v1/render/image/public/...` redimensiona server-side y devuelve
 * webp/jpeg, así que el navegador baja la imagen del tamaño que realmente
 * necesita en vez del archivo original completo.
 *
 * Solo aplica a URLs de Storage: una imagen de Unsplash o un host externo no
 * pasan por el transformador, y ahí hay que usar `srcset` con las variantes que
 * ese proveedor ya soporta por query string.
 */
const RE_STORAGE =
  /^(https:\/\/[^/]+\.supabase\.co)\/storage\/v1\/object\/public\/(.+)$/

/** Anchos que sabe generar el transformador de Supabase Storage. */
const anchosDisponibles: number[] = [160, 240, 320, 480, 640, 800, 1200, 1600]

function urlTransformada(url: string, ancho: number): string | null {
  const match = RE_STORAGE.exec(url)
  if (!match) return null
  const [, host, camino] = match
  return `${host}/storage/v1/render/image/public/${camino}?width=${ancho}&quality=75`
}

/**
 * Arma `srcset` + `sizes` para un tamaño de render dado.
 *
 * Devuelve `srcset: undefined` cuando la imagen no se puede transformar, y en
 * ese caso el `<img>` sigue funcionando con el `src` original.
 */
export function srcsetImagen(
  url: string | null | undefined,
  anchoRender: number,
  /** Para imágenes que ocupan todo el ancho (hero, banners): no se puede acotar
   *  el rango porque el mismo `<img>` se renderiza a 400px en mobile y a
   *  1900px en desktop. */
  rangoCompleto = false,
): { srcset?: string; sizes: string } {
  const sizes = rangoCompleto
    ? '100vw'
    : anchoRender <= 128
      ? '128px'
      : anchoRender <= 160
        ? '160px'
        : anchoRender <= 320
          ? '320px'
          : anchoRender <= 640
            ? '(max-width: 768px) 50vw, 320px'
            : '(max-width: 1024px) 33vw, 420px'

  if (!url) return { sizes }

  // Se ofrecen anchos desde el primero que cubre el render hasta el doble (por
  // pantallas retina). Sin el piso mínimo, un thumbnail de 64px descargaba una
  // variante de 1200px; sin el techo, una card de 320px ofrecía cinco archivos
  // que el navegador nunca iba a elegir.
  const metaAncho = Math.round(anchoRender)
  const cubre = anchosDisponibles.find((a) => a >= metaAncho)
  const minimo = rangoCompleto
    ? anchosDisponibles[0]
    : metaAncho < 160
      ? 160
      : (cubre ?? anchosDisponibles[anchosDisponibles.length - 1])
  const maximo = rangoCompleto
    ? anchosDisponibles[anchosDisponibles.length - 1]
    : Math.max(minimo, metaAncho * 2)

  const candidatas = anchosDisponibles
    .filter((a) => a >= minimo && a <= maximo)
    .map((a) => ({ a, url: urlTransformada(url, a) }))
    .filter((c) => c.url !== null)

  if (candidatas.length === 0) return { sizes }

  return {
    srcset: candidatas.map((c) => `${c.url} ${c.a}w`).join(', '),
    sizes,
  }
}
