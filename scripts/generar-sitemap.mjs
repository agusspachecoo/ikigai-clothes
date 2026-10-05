/**
 * Genera public/sitemap.xml con las rutas públicas reales del catálogo.
 *
 * Corre en postbuild, así que consulta Supabase con la anon key (las políticas
 * RLS de lectura pública ya permiten listar productos y outfits activos). Si la
 * consulta falla, escribe igual las rutas estáticas: un sitemap parcial es mejor
 * que un build roto.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const SITE_URL = (
  process.env.VITE_SITE_URL ?? 'https://ikigai-clothes.vercel.app'
).replace(/\/+$/, '')

const RUTAS_FIJAS = [
  { ruta: '/', prioridad: '1.0', freq: 'daily' },
  { ruta: '/catalogo', prioridad: '0.9', freq: 'daily' },
  { ruta: '/outfits', prioridad: '0.8', freq: 'weekly' },
  { ruta: '/quienes-somos', prioridad: '0.5', freq: 'monthly' },
  { ruta: '/contacto', prioridad: '0.6', freq: 'monthly' },
  { ruta: '/preguntas-frecuentes', prioridad: '0.5', freq: 'monthly' },
  { ruta: '/devoluciones', prioridad: '0.4', freq: 'monthly' },
  { ruta: '/politica-de-privacidad', prioridad: '0.3', freq: 'yearly' },
  { ruta: '/terminos-y-condiciones', prioridad: '0.3', freq: 'yearly' },
]

function leerEnv(ruta) {
  try {
    const texto = readFileSync(resolve(RAIZ, ruta), 'utf8')
    const salida = {}
    for (const linea of texto.split('\n')) {
      const limpio = linea.trim()
      if (limpio === '' || limpio.startsWith('#')) continue
      const i = limpio.indexOf('=')
      if (i === -1) continue
      salida[limpio.slice(0, i).trim()] = limpio.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    }
    return salida
  } catch {
    return {}
  }
}

function escapar(xml) {
  return String(xml).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '&':
        return '&amp;'
      case "'":
        return '&apos;'
      default:
        return '&quot;'
    }
  })
}

function url(ruta, prioridad, freq, ultimoMod) {
  const fecha = ultimoMod ? `<lastmod>${escapar(ultimoMod)}</lastmod>` : ''
  return `  <url>\n    <loc>${escapar(SITE_URL + ruta)}</loc>\n${fecha}    <changefreq>${freq}</changefreq>\n    <priority>${prioridad}</priority>\n  </url>`
}

async function obtenerCatalogos() {
  const env = { ...leerEnv('.env.local'), ...leerEnv('.env'), ...process.env }
  const url_ = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY
  if (!url_ || !key) throw new Error('Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY')

  const supabase = createClient(url_, key, {
    auth: { persistSession: false },
  })

  // `productos` solo tiene created_at: no hay updated_at en el esquema.
  const productos = await supabase
    .from('productos')
    .select('id, created_at')
    .eq('activo', true)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (productos.error) throw new Error(`productos: ${productos.error.message}`)
  return { productos: productos.data ?? [] }
}

async function main() {
  const urls = RUTAS_FIJAS.map((r) => url(r.ruta, r.prioridad, r.freq, null))
  let productos = []

  try {
    productos = (await obtenerCatalogos()).productos
    console.log(`  sitemap: ${productos.length} productos activos`)
  } catch (error) {
    // Un sitemap parcial le sirve al buscador; cortar el build, no.
    console.warn(`  sitemap: no se pudo consultar Supabase (${error.message}).`)
    console.warn('  sitemap: se escriben solo las rutas estáticas.')
  }

  // Los outfits no van como URLs propias: `/outfits` es una página única de
  // galería, no hay ruta /outfit/:id, así que no hay nada que enlazar.
  for (const p of productos) {
    urls.push(url(`/producto/${p.id}`, '0.7', 'weekly', p.created_at))
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`

  // Se escribe en ambos: `public/` para que lo sirva el dev server, y `dist/`
  // para el deploy. Hace falta en los dos porque este script corre en postbuild,
  // es decir DESPUÉS de que Vite copiara public/ a dist/: si solo escribimos en
  // public/, en un build limpio el sitemap no llega a dist/.
  const destinos = [resolve(RAIZ, 'public/sitemap.xml'), resolve(RAIZ, 'dist/sitemap.xml')]
  for (const destino of destinos) {
    try {
      writeFileSync(destino, xml, 'utf8')
    } catch (error) {
      // dist/ puede no existir si se llamó al script suelto: no es un error.
      if (destino.includes('dist') === false) throw error
    }
  }
  console.log(`  sitemap: ${urls.length} URLs escritas en public/ y dist/`)
}

main().catch((error) => {
  console.error(`  sitemap: falló (${error.message})`)
  process.exitCode = 0
})
