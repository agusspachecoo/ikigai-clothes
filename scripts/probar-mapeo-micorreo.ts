// Prueba del mapeo puro rates de MiCorreo -> OpcionEnvio.
// Corre con el strip-types de Node 22+ (sin build, sin red):
//   node scripts/probar-mapeo-micorreo.ts
//
// Usa la respuesta REAL que devolvió /rates el 2026-10-05 para
// 3360 -> 1001 con 500 g, para que el mapeo se verifique contra datos
// de producción y no contra un fixture inventado.

import {
  esClasico,
  leyendaPlazo,
  marcarTags,
  rateAOpcionEnvio,
  ratesACpciones,
} from '../src/lib/mapeoMicorreo.ts'
import type { OpcionMicorreo } from '../src/lib/micorreo.ts'

const RATES_REALES: OpcionMicorreo[] = [
  { deliveredType: 'S', productType: 'CP', productName: 'Correo Argentino Clasico', price: 7415, costo: 7415, tiempo_estimado: '2 días a 5 días hábiles', deliveryTimeMin: '2', deliveryTimeMax: '5' },
  { deliveredType: 'S', productType: 'EP', productName: 'Correo Argentino Expreso', price: 13590, costo: 13590, tiempo_estimado: '1 día a 3 días hábiles', deliveryTimeMin: '1', deliveryTimeMax: '3' },
  { deliveredType: 'D', productType: 'CP', productName: 'Correo Argentino Clasico', price: 10509, costo: 10509, tiempo_estimado: '2 días a 5 días hábiles', deliveryTimeMin: '2', deliveryTimeMax: '5' },
  { deliveredType: 'D', productType: 'EP', productName: 'Correo Argentino Expreso', price: 19262, costo: 19262, tiempo_estimado: '1 día a 3 días hábiles', deliveryTimeMin: '1', deliveryTimeMax: '3' },
]

let fallos = 0

function ok(cond: boolean, etiqueta: string, detalle?: unknown) {
  if (cond) {
    console.log(`  ok   ${etiqueta}`)
  } else {
    fallos++
    console.log(`  FALLA ${etiqueta}`, detalle ?? '')
  }
}

console.log('\n1. filtro de servicio (sólo Clásico)')
ok(RATES_REALES.filter(esClasico).length === 2, 'esClasico deja 2 de 4')
ok(!esClasico(RATES_REALES[1]), 'Expreso (EP) queda descartado')
ok(esClasico(RATES_REALES[0]), 'Clásico (CP) queda')

console.log('\n2. leyenda de plazo')
ok(leyendaPlazo(RATES_REALES[0]) === '2 a 5 días hábiles', '"2 a 5 días hábiles"', leyendaPlazo(RATES_REALES[0]))
ok(leyendaPlazo(RATES_REALES[1]) === '1 a 3 días hábiles', '"1 a 3 días hábiles"', leyendaPlazo(RATES_REALES[1]))
ok(
  leyendaPlazo({ deliveryTimeMin: '3', deliveryTimeMax: '3', costo: 1 }) === '3 días hábiles',
  'min = max -> "3 días hábiles"',
  leyendaPlazo({ deliveryTimeMin: '3', deliveryTimeMax: '3', costo: 1 }),
)
ok(
  leyendaPlazo({ costo: 1, tiempo_estimado: '5 a 7 días hábiles' }) === '5 a 7 días hábiles',
  'sin deliveryTime* cae a tiempo_estimado',
)

console.log('\n3. precio sin tocar (regla 1: tal cual la API)')
const dom = rateAOpcionEnvio(RATES_REALES[2])
const suc = rateAOpcionEnvio(RATES_REALES[0])
ok(dom?.costo === 10509, 'domicilio Clásico = $10.509', dom?.costo)
ok(suc?.costo === 7415, 'sucursal Clásico = $7.415', suc?.costo)

console.log('\n4. mapeo de campos')
ok(dom?.id_servicio === 'micorreo-d', 'id_servicio domicilio', dom?.id_servicio)
ok(suc?.id_servicio === 'micorreo-s', 'id_servicio sucursal', suc?.id_servicio)
ok(dom?.service_type.code === 'DOMICILIO', 'code DOMICILIO')
ok(suc?.service_type.code === 'SUCURSAL', 'code SUCURSAL')
ok(dom?.service_type.name === 'Entrega a domicilio', 'name Entrega a domicilio')
ok(suc?.service_type.name === 'Retiro en sucursal', 'name Retiro en sucursal')
ok(dom?.modalidad === 'domicilio', 'modalidad domicilio')
ok(suc?.modalidad === 'sucursal', 'modalidad sucursal')
ok(dom?.carrier.name === 'Correo Argentino Clasico', 'carrier.name = productName', dom?.carrier.name)
ok(dom?.estimado.leyenda === '2 a 5 días hábiles', 'estimado.leyenda', dom?.estimado.leyenda)
ok(dom?.estimado.minimo_dias === 2 && dom?.estimado.maximo_dias === 5, 'días del estimado')
ok(dom?.horas_entrega === 120, 'horas_entrega = 5*24', dom?.horas_entrega)
ok(dom?.selectable === true, 'selectable')
ok(dom?.tiempo_estimado === '2 a 5 días hábiles', 'tiempo_estimado', dom?.tiempo_estimado)

console.log('\n5. rate inválido no revienta')
ok(rateAOpcionEnvio({ deliveredType: 'D', costo: null }) === null, 'costo null -> null', rateAOpcionEnvio({ deliveredType: 'D', costo: null })?.costo)
ok(rateAOpcionEnvio({ deliveredType: 'D', costo: 0, price: 0 })?.costo === 0, 'precio 0 explícito se conserva')
ok(rateAOpcionEnvio({ deliveredType: 'D', costo: null, price: Number.NaN }) === null, 'price NaN -> null')

console.log('\n6. ratesACpciones completo')
const opciones = ratesACpciones(RATES_REALES)
ok(opciones.length === 2, 'devuelve 2 opciones (sólo Clásico)', opciones.length)
ok(opciones.every((o) => o.costo > 0), 'todas con precio')
ok(opciones.some((o) => o.costo === 10509) && opciones.some((o) => o.costo === 7415), 'precios reales intactos')
ok(
  !opciones.some((o) => o.costo === 19262 || o.costo === 13590),
  'ninguna opción de Expreso',
)
ok(opciones.filter((o) => o.tags.includes('cheapest')).length === 1, 'exactamente 1 cheapest')
ok(opciones.find((o) => o.costo === 7415)?.tags.includes('cheapest'), 'cheapest = sucursal $7.415')
ok(opciones.filter((o) => o.tags.includes('fastest')).length >= 1, 'hay fastest')
ok(
  opciones.every((o) => o.tags.includes('cheapest') || o.tags.includes('fastest')),
  'ambas opciones quedan marcadas (mismo plazo)',
)

console.log('\n7. etiquetas en la fila del checkout')
ok(
  `${opciones[0].carrier.name} · ${opciones[0].service_type.name}` !==
    `${opciones[1].carrier.name} · ${opciones[1].service_type.name}`,
  'las dos filas se distinguen entre sí',
)

console.log('\n8. entrada vacía no explota')
const vacias = ratesACpciones([])
ok(vacias.length === 0, 'rates [] -> opciones []')
const sinClasico = ratesACpciones([RATES_REALES[1]])
ok(sinClasico.length === 0, 'sólo Expreso -> opciones [] (dispara fallback local)')

console.log('\n9. marcarTags sobre lista vacía')
let lanio = false
try {
  marcarTags([])
} catch {
  lanio = true
}
ok(!lanio, 'marcarTags([]) no lanza')

console.log(fallos === 0 ? '\nRESULTADO: OK\n' : `\nRESULTADO: ${fallos} fallo(s)\n`)
process.exit(fallos === 0 ? 0 : 1)
