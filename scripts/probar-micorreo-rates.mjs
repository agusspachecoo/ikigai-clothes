#!/usr/bin/env node
// Prueba puntual de la acción `rates` de la Edge Function micorreo-envio.
//
//   node scripts/probar-micorreo-rates.mjs
//   node scripts/probar-micorreo-rates.mjs 1440 5000 1001
//
// No toca la tienda ni genera costos: sólo lee tarifas.
// Salida exitosa (exit 0) si MiCorreo devuelve al menos un rate con price.

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function leerEnvLocal() {
  const vars = {}
  try {
    for (const linea of readFileSync(resolve(raiz, '.env.local'), 'utf8').split('\n')) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* sin .env.local: se apoyan en el entorno */
  }
  return vars
}

const env = { ...leerEnvLocal(), ...process.env }

const SUPABASE_URL = (env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY ?? ''

const cpOrigen = process.argv[2] ?? '3360'
const pesoG = Number(process.argv[3] ?? 500)
const cpDestino = process.argv[4] ?? '1001'

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local')
  process.exit(1)
}

const url = `${SUPABASE_URL}/functions/v1/micorreo-envio`

const casos = [
  { etiqueta: 'Sólo Domicilio (D)', deliveredType: 'D' },
  { etiqueta: 'Sólo Sucursal (S)', deliveredType: 'S' },
  { etiqueta: 'Ambas opciones', deliveredType: undefined },
]

async function llamar(body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(body),
  })
  const texto = await res.text()
  let data = null
  try {
    data = JSON.parse(texto)
  } catch {
    /* el backend no devolvió JSON */
  }
  return { status: res.status, data, texto }
}

function mostrarRates(data) {
  const rates = Array.isArray(data?.rates) ? data.rates : []
  if (!rates.length) {
    console.log('  (sin rates en la respuesta)')
    if (data?.error) console.log('  error:', data.error)
    return { cantidad: 0, conPrecio: 0 }
  }
  const filas = rates.map((r) => ({
    entrega: r.deliveredType ?? r.deliveryType ?? '-',
    producto: r.productName ?? r.productType ?? '-',
    precio: r.costo ?? r.price ?? r.precio ?? null,
    eta: r.tiempo_estimado ?? r.eta ?? null,
  }))
  console.table(filas)
  return {
    cantidad: rates.length,
    conPrecio: rates.filter((r) => Number(r.costo ?? r.price) > 0).length,
  }
}

const base = {
  postalCodeOrigin: cpOrigen,
  postalCodeDestination: cpDestino,
  dimensions: { weight: pesoG, height: 10, width: 20, length: 25 },
}

let fallos = 0

console.log(`\nMiCorreo /rates  →  origen ${cpOrigen}  destino ${cpDestino}  peso ${pesoG} g`)
console.log(`Endpoint: ${url}\n`)

for (const caso of casos) {
  console.log(`── ${caso.etiqueta}`)
  const body = { action: 'rates', ...base }
  if (caso.deliveredType) body.deliveredType = caso.deliveredType

  const { status, data, texto } = await llamar(body)

  if (status !== 200) {
    console.log(`  HTTP ${status}`)
    console.log(`  ${texto.slice(0, 400)}\n`)
    fallos++
    continue
  }

  const { cantidad, conPrecio } = mostrarRates(data)
  if (cantidad === 0 || conPrecio === 0) fallos++
  console.log()
}

console.log(fallos === 0 ? 'RESULTADO: OK — precios recibidos' : `RESULTADO: FALLÓ en ${fallos} caso(s)`)
process.exit(fallos === 0 ? 0 : 1)
