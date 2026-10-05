import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  DESCRIPCION_POR_DEFECTO,
  NOMBRE_TIENDA,
  OG_IMAGE,
  SITE_URL,
  canonical,
  datosEstructuradosLocal,
  metaDeRuta,
} from '../lib/seo'

/**
 * Escribe title, description, canonical y las etiquetas Open Graph en el DOM.
 *
 * En una SPA el documento no se vuelve a renderizar por ruta, así que sin esto
 * todas las páginas comparten el title del index.html y los buscadores las
 * indexan como duplicados.
 */

interface Opciones {
  title?: string
  description?: string
  /** URL absoluta o relativa de la imagen para og:image. */
  image?: string
  type?: string
  noindex?: boolean
}

const OG_BASE = 'og:'
const TWITTER_BASE = 'twitter:'

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attr, key)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function setLink(rel: string, href: string) {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!tag) {
    tag = document.createElement('link')
    tag.setAttribute('rel', rel)
    document.head.appendChild(tag)
  }
  tag.setAttribute('href', href)
}

export function useSeo(opciones: Opciones = {}) {
  const { pathname } = useLocation()
  const porRuta = metaDeRuta(pathname)

  const titulo = opciones.title ?? porRuta.title
  const descripcion = opciones.description ?? porRuta.description ?? DESCRIPCION_POR_DEFECTO
  const imagen = opciones.image ?? OG_IMAGE
  const tipo = opciones.type ?? 'website'
  const noindex = opciones.noindex ?? porRuta.noindex ?? false

  useEffect(() => {
    document.title = titulo
    const url = canonical(pathname)

    setMeta('name', 'description', descripcion)
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow')
    setLink('canonical', url)

    setMeta('property', `${OG_BASE}title`, titulo)
    setMeta('property', `${OG_BASE}description`, descripcion)
    setMeta('property', `${OG_BASE}url`, url)
    setMeta('property', `${OG_BASE}image`, imagen)
    setMeta('property', `${OG_BASE}site_name`, NOMBRE_TIENDA)
    setMeta('property', `${OG_BASE}locale`, 'es_AR')
    setMeta('property', `${OG_BASE}type`, tipo)

    // Twitter cae en su propio namespace: no lee las etiquetas og:.
    setMeta('name', `${TWITTER_BASE}card`, 'summary_large_image')
    setMeta('name', `${TWITTER_BASE}title`, titulo)
    setMeta('name', `${TWITTER_BASE}description`, descripcion)
    setMeta('name', `${TWITTER_BASE}image`, imagen)
  }, [descripcion, imagen, noindex, pathname, tipo, titulo])

  // JSON-LD del negocio. Los datos no dependen de la ruta, así que se escribe
  // una única vez y no se vuelve a tocar en cada navegación.
  useEffect(() => {
    const ID = 'jsonld-negocio'
    let tag = document.getElementById(ID) as HTMLScriptElement | null
    if (!tag) {
      tag = document.createElement('script')
      tag.id = ID
      tag.type = 'application/ld+json'
      document.head.appendChild(tag)
    }
    tag.textContent = JSON.stringify(datosEstructuradosLocal())
  }, [])
}

/** Resuelve una imagen de Supabase Storage o del catálogo a URL absoluta. */
export function urlAbsoluta(imagen: string | null | undefined): string {
  if (!imagen) return OG_IMAGE
  if (imagen.startsWith('http')) return imagen
  return `${SITE_URL}${imagen.startsWith('/') ? '' : '/'}${imagen}`
}
