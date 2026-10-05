/**
 * Datos de SEO del sitio: dominio canónico, imagen OG y metadatos por ruta.
 *
 * Es una SPA de Vite, así que no hay App Router ni metadata exportada: los
 * titles y las etiquetas se escriben en el DOM desde `useSeo`.
 */

import { CONTACTO, SHOWROOM } from './contacto'

/** Dominio canónico. Cambiarlo acá alcanza para canonical, OG y sitemap. */
const DOMINIO_FALLBACK = 'https://ikigai-clothes.vercel.app'

export const SITE_URL = (
  import.meta.env.VITE_SITE_URL ?? DOMINIO_FALLBACK
).replace(/\/+$/, '')

export const NOMBRE_TIENDA = 'Ikigai Clothes'
export const OG_IMAGE = `${SITE_URL}/og-image.jpg`

export const DESCRIPCION_POR_DEFECTO =
  'Indumentaria urbana y deportiva en Oberá, Misiones. Remeras, buzos, pantalones y accesorios con envío a todo el país. 10% OFF pagando por transferencia.'

/** Canonical limpio: sin query string, porque `/catalogo?categoria=x` y `/catalogo` son la misma página. */
export function canonical(pathname: string): string {
  const limpio = pathname.split('?')[0].replace(/\/+$/, '')
  return `${SITE_URL}${limpio === '' ? '' : limpio}`
}

interface MetaRuta {
  title: string
  description: string
  /** Rutas que nunca deben indexarse (admin, perfil, checkout). */
  noindex?: boolean
}

export function metaDeRuta(pathname: string): MetaRuta {
  const ruta = pathname.split('?')[0].replace(/\/+$/, '')

  // Todo lo que cuelgue del panel o del checkout es privado.
  if (ruta.startsWith('/admin') || ruta.startsWith('/perfil') || ruta.startsWith('/checkout')) {
    return { title: NOMBRE_TIENDA, description: DESCRIPCION_POR_DEFECTO, noindex: true }
  }

  switch (ruta) {
    case '':
      return {
        title: `${NOMBRE_TIENDA} · Indumentaria urbana en Oberá, Misiones`,
        description: DESCRIPCION_POR_DEFECTO,
      }
    case '/catalogo':
      return {
        title: `Catálogo · ${NOMBRE_TIENDA}`,
        description:
          'Todos los productos de Ikigai Clothes: remeras, buzos, pantalones y accesorios. Filtros por categoría, talle y precio.',
      }
    case '/outfits':
      return {
        title: `Outfits y Combos · ${NOMBRE_TIENDA}`,
        description:
          'Combos de prendas con precio especial. Armá tu look de Invierno o Summer con Ikigai Clothes y pagá por transferencia.',
      }
    case '/contacto':
      return {
        title: `Contacto · ${NOMBRE_TIENDA}`,
        description:
          'Escribinos por WhatsApp, visitanos nuestro showroom en Oberá, Misiones o seguinos en redes. Atención de lunes a sábado.',
      }
    case '/quienes-somos':
      return {
        title: `Quiénes somos · ${NOMBRE_TIENDA}`,
        description: 'Conocé la historia de Ikigai Clothes, una marca de indumentaria urbana de Oberá, Misiones.',
      }
    case '/devoluciones':
      return {
        title: `Devoluciones y Cambios · ${NOMBRE_TIENDA}`,
        description: 'Política de devoluciones, cambios y garantía de Ikigai Clothes.',
      }
    case '/preguntas-frecuentes':
      return {
        title: `Preguntas Frecuentes · ${NOMBRE_TIENDA}`,
        description: 'Consultas frecuentes sobre envíos, pagos, talles y compras en Ikigai Clothes.',
      }
    case '/politica-de-privacidad':
      return {
        title: `Política de Privacidad · ${NOMBRE_TIENDA}`,
        description:
          'Cómo tratamos los datos personales que compartís con Ikigai Clothes conforme a la Ley 25.326 de Protección de Datos Personales.',
      }
    case '/terminos-y-condiciones':
      return {
        title: `Términos y Condiciones · ${NOMBRE_TIENDA}`,
        description:
          'Condiciones de venta de Ikigai Clothes: modalidades de compra, pagos, envíos, cambios y garantía.',
      }
    default:
      return { title: NOMBRE_TIENDA, description: DESCRIPCION_POR_DEFECTO }
  }
}

/** Rutas públicas que se listan en el sitemap (las privadas no). */
export const RUTAS_PUBLICAS = [
  '/',
  '/catalogo',
  '/outfits',
  '/contacto',
  '/quienes-somos',
  '/devoluciones',
  '/preguntas-frecuentes',
  '/politica-de-privacidad',
  '/terminos-y-condiciones',
] as const

/**
 * JSON-LD de `ClothingStore` (subtipo de LocalBusiness).
 *
 * Se inyecta una sola vez desde `useSeo`. Sirve para que Google arme el panel
 * de conocimiento con la dirección, el teléfono y el horario reales, que es lo
 * que mueve la visibilidad local de un negocio con showroom.
 */
export function datosEstructuradosLocal(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ClothingStore',
    name: NOMBRE_TIENDA,
    description: DESCRIPCION_POR_DEFECTO,
    url: SITE_URL,
    image: OG_IMAGE,
    telephone: CONTACTO.whatsappVisible,
    email: CONTACTO.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: SHOWROOM.calle,
      addressLocality: SHOWROOM.ciudad,
      addressRegion: SHOWROOM.provincia,
      postalCode: SHOWROOM.codigoPostal,
      addressCountry: 'AR',
    },
    sameAs: [CONTACTO.instagram, CONTACTO.tiktok],
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        opens: '10:00',
        closes: '20:00',
      },
    ],
  }
}
