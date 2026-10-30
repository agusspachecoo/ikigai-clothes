export type TipoPromocion = 'pack' | 'combo'

export interface PromocionGrupo {
  id?: string
  nombre?: string | null
  cantidad_requerida: number
  orden?: number
  producto_ids: string[]
}

export interface Promocion {
  id: string
  nombre: string
  descripcion?: string | null
  tipo: TipoPromocion
  descuento_porcentaje: number | null
  precio_fijo: number | null
  prioridad: number
  activo: boolean
  fecha_inicio?: string | null
  fecha_fin?: string | null
  grupos: PromocionGrupo[]
}

export interface ItemPromocion {
  producto_id: string
  talle: string
  cantidad: number
  precio_unitario: number
}

export interface PromocionAplicada {
  promocion_id: string
  nombre: string
  descripcion?: string | null
  tipo: TipoPromocion
  descuento: number
  packs?: number
  conjuntos?: number
}

export interface ResultadoPromociones {
  descuento: number
  aplicadas: PromocionAplicada[]
  unidadesConsumidas: Map<string, number>
}

interface Linea {
  key: string
  producto_id: string
  precio_unitario: number
  cantidad: number
}

interface Unidad {
  key: string
  precio_unitario: number
}

interface GrupoNormalizado {
  producto_ids: Set<string>
  cantidad_requerida: number
  orden: number
}

function round2(valor: number): number {
  return Math.round(valor * 100) / 100
}

export function claveLinea(item: { producto_id: string; talle: string }): string {
  return `${item.producto_id}::${item.talle}`
}

export function esPromocionVigente(promo: Promocion, ahora: Date = new Date()): boolean {
  if (!promo.activo) return false

  const instante = ahora.getTime()
  const inicio = promo.fecha_inicio ? new Date(promo.fecha_inicio).getTime() : null
  const fin = promo.fecha_fin ? new Date(promo.fecha_fin).getTime() : null

  if (inicio !== null && !Number.isNaN(inicio) && instante < inicio) return false
  if (fin !== null && !Number.isNaN(fin) && instante > fin) return false
  return true
}

export function promocionDestacada(
  promociones: Promocion[],
  items: ItemPromocion[] = [],
  ahora: Date = new Date(),
): Promocion | null {
  const vigentes = promociones.filter((promo) => esPromocionVigente(promo, ahora))
  if (vigentes.length === 0) return null

  const lineas = lineasDeItems(items)
  const evaluaciones: EvaluacionPromocion[] = []

  for (const promo of vigentes) {
    const evaluacion = evaluarPromocion(promo, lineas)
    if (evaluacion) evaluaciones.push(evaluacion)
  }

  if (evaluaciones.length > 0) {
    const mejor = [...evaluaciones].sort(
      (a, b) =>
        b.descuento - a.descuento ||
        Number(b.promo.prioridad) - Number(a.promo.prioridad) ||
        a.promo.nombre.localeCompare(b.promo.nombre),
    )[0]
    return mejor.promo
  }

  return vigentes
    .slice()
    .sort((a, b) => Number(b.prioridad) - Number(a.prioridad) || a.nombre.localeCompare(b.nombre))[0]
}

function normalizarGrupos(promo: Promocion): GrupoNormalizado[] {
  return (promo.grupos ?? [])
    .map((grupo, index) => ({
      producto_ids: new Set((grupo.producto_ids ?? []).map(String).filter(Boolean)),
      cantidad_requerida: Math.max(1, Math.floor(Number(grupo.cantidad_requerida) || 1)),
      orden: Number.isFinite(Number(grupo.orden)) ? Number(grupo.orden) : index,
    }))
    .filter((grupo) => grupo.producto_ids.size > 0)
    .sort((a, b) => a.orden - b.orden)
}

function lineasDeItems(items: ItemPromocion[]): Map<string, Linea> {
  const lineas = new Map<string, Linea>()

  for (const item of items) {
    const cantidad = Math.max(0, Math.floor(Number(item.cantidad) || 0))
    if (cantidad <= 0) continue

    const key = claveLinea(item)
    const existente = lineas.get(key)

    if (existente) {
      existente.cantidad += cantidad
      continue
    }

    lineas.set(key, {
      key,
      producto_id: String(item.producto_id),
      precio_unitario: Math.max(0, Number(item.precio_unitario) || 0),
      cantidad,
    })
  }

  return lineas
}

function unidadesDisponibles(
  lineas: Map<string, Linea>,
  productos: Set<string>,
  consumidas: Map<string, number>,
): Unidad[] {
  const unidades: Unidad[] = []

  for (const linea of lineas.values()) {
    if (!productos.has(linea.producto_id)) continue

    const libres = Math.max(0, linea.cantidad - (consumidas.get(linea.key) ?? 0))
    for (let i = 0; i < libres; i++) {
      unidades.push({
        key: linea.key,
        precio_unitario: linea.precio_unitario,
      })
    }
  }

  return unidades.sort(
    (a, b) => b.precio_unitario - a.precio_unitario || a.key.localeCompare(b.key),
  )
}

function marcarConsumidas(consumidas: Map<string, number>, unidades: Unidad[]) {
  for (const unidad of unidades) {
    consumidas.set(unidad.key, (consumidas.get(unidad.key) ?? 0) + 1)
  }
}

function sumarPrecios(unidades: Unidad[]): number {
  return unidades.reduce((total, unidad) => total + unidad.precio_unitario, 0)
}

export interface EvaluacionPromocion {
  promo: Promocion
  descuento: number
  packs?: number
  conjuntos?: number
  consumida: Map<string, number>
}

function evaluarPromocion(promo: Promocion, lineas: Map<string, Linea>): EvaluacionPromocion | null {
  const grupos = normalizarGrupos(promo)
  if (grupos.length === 0) return null

  const consumida = new Map<string, number>()

  if (promo.tipo === 'pack') {
    const grupo = grupos[0]
    const requeridas = grupo.cantidad_requerida
    const precioFijo = Number(promo.precio_fijo) || 0
    if (requeridas < 1 || precioFijo <= 0) return null

    const unidades = unidadesDisponibles(lineas, grupo.producto_ids, consumida)
    const maxPacks = Math.floor(unidades.length / requeridas)
    let packs = 0
    let descuento = 0

    for (let i = 0; i < maxPacks; i++) {
      const pack = unidades.slice(i * requeridas, (i + 1) * requeridas)
      const ahorro = round2(sumarPrecios(pack) - precioFijo)
      if (ahorro <= 0) break

      descuento += ahorro
      marcarConsumidas(consumida, pack)
      packs++
    }

    if (packs <= 0) return null

    return { promo, descuento: round2(descuento), packs, consumida }
  }

  if (grupos.length < 2) return null

  const porcentaje = Math.min(100, Math.max(0, Number(promo.descuento_porcentaje) || 0)) / 100
  if (porcentaje <= 0) return null

  const gruposConUnidades = grupos.map((grupo) => ({
    grupo,
    unidades: unidadesDisponibles(lineas, grupo.producto_ids, consumida),
  }))

  const conjuntos = Math.min(
    ...gruposConUnidades.map(({ grupo, unidades }) =>
      Math.floor(unidades.length / grupo.cantidad_requerida),
    ),
  )
  if (conjuntos <= 0) return null

  let aplicados = 0
  let descuento = 0

  for (let i = 0; i < conjuntos; i++) {
    const seleccion: Unidad[] = []

    for (const { grupo, unidades } of gruposConUnidades) {
      const desde = i * grupo.cantidad_requerida
      seleccion.push(...unidades.slice(desde, desde + grupo.cantidad_requerida))
    }

    const ahorro = round2(sumarPrecios(seleccion) * porcentaje)
    if (ahorro <= 0) continue

    descuento += ahorro
    marcarConsumidas(consumida, seleccion)
    aplicados++
  }

  if (aplicados <= 0) return null

  return { promo, descuento: round2(descuento), conjuntos: aplicados, consumida }
}

export function calcularPromociones(
  items: ItemPromocion[],
  promociones: Promocion[],
  ahora: Date = new Date(),
): ResultadoPromociones {
  const lineas = lineasDeItems(items)
  const subtotal = items.reduce(
    (total, item) =>
      total + Math.max(0, Number(item.precio_unitario) || 0) * Math.max(0, Number(item.cantidad) || 0),
    0,
  )

  const vigentes = promociones
    .filter((promo) => esPromocionVigente(promo, ahora))
    .sort((a, b) => Number(b.prioridad) - Number(a.prioridad) || a.nombre.localeCompare(b.nombre))

  // Una misma producto puede participar en varias promociones activas a la vez.
  // Cada promo se evalúa sobre el carrito completo (con unidades independientes)
  // y se arma la combinación más beneficiosa para el comprador.
  const evaluaciones: EvaluacionPromocion[] = []
  for (const promo of vigentes) {
    const evaluacion = evaluarPromocion(promo, lineas)
    if (evaluacion) evaluaciones.push(evaluacion)
  }

  const combinacion = [...evaluaciones].sort(
    (a, b) =>
      b.descuento - a.descuento ||
      Number(b.promo.prioridad) - Number(a.promo.prioridad) ||
      a.promo.nombre.localeCompare(b.promo.nombre),
  )

  const aplicadas: PromocionAplicada[] = []
  const consumida = new Map<string, number>()
  let descuento = 0

  for (const evaluacion of combinacion) {
    const compatible = [...evaluacion.consumida.entries()].every(
      ([key, cantidad]) => {
        const yaConsumida = consumida.get(key) ?? 0
        const linea = lineas.get(key)
        const disponibles = linea ? Math.max(0, linea.cantidad - yaConsumida) : 0
        return cantidad <= disponibles
      },
    )
    if (!compatible) continue

    descuento += evaluacion.descuento
    for (const [key, cantidad] of evaluacion.consumida) {
      consumida.set(key, (consumida.get(key) ?? 0) + cantidad)
    }

    aplicadas.push({
      promocion_id: evaluacion.promo.id,
      nombre: evaluacion.promo.nombre,
      descripcion: evaluacion.promo.descripcion ?? undefined,
      tipo: evaluacion.promo.tipo,
      descuento: evaluacion.descuento,
      packs: evaluacion.packs,
      conjuntos: evaluacion.conjuntos,
    })
  }

  const descuentoFinal = Math.min(round2(descuento), round2(subtotal))

  return { descuento: descuentoFinal, aplicadas, unidadesConsumidas: consumida }
}
