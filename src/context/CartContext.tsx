import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { CartItem } from '../types/cart'
import { CartContext, type DetallePrenda, type ItemNuevo, type ResultadoValidacion } from './cart'
import { supabase } from '../lib/supabase'
import type { CuponAplicado } from '../lib/cupones'
import { calcularDescuentoCupon } from '../lib/cupones'
import { calcularDescuentoOutfit, DESCUENTO_OUTFIT_PCT, type OutfitComposicion } from '../lib/outfits'
import { claveVariante, detectarColisiones, idsOutfitsARemover, type Colision } from '../lib/conflictos'
import { calcularPromociones, type Promocion } from '../lib/promociones'
import { normalizarUrlImagen } from '../lib/imagenes'

const STORAGE_KEY = 'ikigai-cart'
const CUPON_STORAGE_KEY = 'ikigai-cupon'

/** Prenda tal como la define el outfit, con el talle elegido en el modal. */
type PrendaOutfit = { producto_id: string; talle: string }

function capacidadStock(...valores: Array<number | undefined>): number {
  const finitos = valores.filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v),
  )
  return finitos.length > 0 ? Math.max(0, Math.floor(Math.min(...finitos))) : Number.POSITIVE_INFINITY
}

function agregarItem(prev: CartItem[], item: CartItem): CartItem[] {
  const cantidad = Math.max(1, Math.floor(Number(item.cantidad) || 1))

  if (item.outfitId) {
    const existe = prev.some(
      (i) =>
        i.outfitId === item.outfitId &&
        i.producto_id === item.producto_id &&
        i.talle === item.talle,
    )
    return existe ? prev : [...prev, { ...item, cantidad }]
  }

  const indice = prev.findIndex(
    (i) => !i.outfitId && i.producto_id === item.producto_id && i.talle === item.talle,
  )
  if (indice === -1) return [...prev, { ...item, cantidad }]

  const existente = prev[indice]
  const cap = capacidadStock(existente.stock_disponible, item.stock_disponible)
  const nuevaCantidad = Math.min(cap, existente.cantidad + cantidad)

  return prev.map((i, index) =>
    index === indice
      ? {
          ...existente,
          ...item,
          cantidad: nuevaCantidad,
          stock_disponible: Number.isFinite(cap)
            ? cap
            : (item.stock_disponible ?? existente.stock_disponible),
        }
      : i,
  )
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      return (JSON.parse(raw) as CartItem[]).map((item) => ({
        ...item,
        imagen: normalizarUrlImagen(item.imagen, { carpeta: 'productos' }),
      }))
    } catch {
      return []
    }
  })

  const [carritoAbierto, setCarritoAbierto] = useState(false)

  // Espejo del estado para que la validación siempre lea el carrito más
  // reciente, sin depender del closure del render que originó el click.
  const itemsRef = useRef<CartItem[]>(items)

  const [cupon, setCupon] = useState<CuponAplicado | null>(() => {
    try {
      const raw = localStorage.getItem(CUPON_STORAGE_KEY)
      return raw ? (JSON.parse(raw) as CuponAplicado) : null
    } catch {
      return null
    }
  })

  // Composición de los outfits activos (solo ids de producto): se usa para
  // detectar si el carrito completa un combo y mostrar el 5% en el resumen.
  // El cálculo autoritativo lo hace `crear-orden`; esto es solo para la UI.
  const [outfits, setOutfits] = useState<OutfitComposicion[]>([])
  const [promociones, setPromociones] = useState<Promocion[]>([])

  useEffect(() => {
    let cancelado = false
    async function cargarOutfits() {
      const { data, error } = await supabase
        .from('outfits')
        .select('outfit_items(producto_id)')
        .eq('activo', true)
      if (cancelado) return
      if (error) {
        // Sin outfits disponibles simplemente no se muestra el descuento.
        console.error('No se pudieron cargar los outfits:', error.message)
        return
      }
      setOutfits(
        (data ?? []).map((o) => ({
          producto_ids: (o.outfit_items ?? []).map(
            (i: { producto_id: string }) => String(i.producto_id),
          ),
        })),
      )
    }
    void cargarOutfits()
    return () => {
      cancelado = true
    }
  }, [])

  useEffect(() => {
    let cancelado = false

    async function cargarPromociones() {
      const { data, error } = await supabase
        .from('promociones')
        .select(
          'id, nombre, descripcion, tipo, descuento_porcentaje, precio_fijo, prioridad, activo, fecha_inicio, fecha_fin, promocion_grupos(cantidad_requerida, orden, promocion_grupo_productos(producto_id))',
        )
        .eq('activo', true)
        .order('prioridad', { ascending: false })

      if (cancelado) return
      if (error) {
        console.error('No se pudieron cargar las promociones:', error.message)
        return
      }

      const filas = (data ?? []) as Array<{
        id: string
        nombre: string
        descripcion: string | null
        tipo: 'pack' | 'combo'
        descuento_porcentaje: number | null
        precio_fijo: number | null
        prioridad: number
        activo: boolean
        fecha_inicio: string | null
        fecha_fin: string | null
        promocion_grupos:
          | Array<{
              cantidad_requerida: number
              orden: number
              promocion_grupo_productos: Array<{ producto_id: string }> | null
            }>
          | null
      }>

      setPromociones(
        filas.map((fila) => ({
          id: String(fila.id),
          nombre: fila.nombre,
          descripcion: fila.descripcion,
          tipo: fila.tipo,
          descuento_porcentaje: fila.descuento_porcentaje,
          precio_fijo: fila.precio_fijo,
          prioridad: Number(fila.prioridad) || 0,
          activo: fila.activo,
          fecha_inicio: fila.fecha_inicio,
          fecha_fin: fila.fecha_fin,
          grupos: (fila.promocion_grupos ?? [])
            .slice()
            .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0))
            .map((grupo) => ({
              cantidad_requerida: Number(grupo.cantidad_requerida) || 1,
              orden: Number(grupo.orden) || 0,
              producto_ids: (grupo.promocion_grupo_productos ?? []).map((producto) =>
                String(producto.producto_id),
              ),
            })),
        })),
      )
    }

    void cargarPromociones()
    return () => {
      cancelado = true
    }
  }, [])

  useEffect(() => {
    itemsRef.current = items
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  useEffect(() => {
    if (cupon) {
      localStorage.setItem(CUPON_STORAGE_KEY, JSON.stringify(cupon))
    } else {
      localStorage.removeItem(CUPON_STORAGE_KEY)
    }
  }, [cupon])

  /**
   * Único punto de escritura del carrito: aplica `updater` sobre el estado
   * vigente y sincroniza el ref en la misma pasada. Así una lectura seguida de
   * una mutación siempre ve el resultado anterior.
   */
  const commit = useCallback((updater: (prev: CartItem[]) => CartItem[]) => {
    itemsRef.current = updater(itemsRef.current)
    setItems(itemsRef.current)
  }, [])

  /** Normaliza un item de la UI a un CartItem completo. */
  const aCartItem = useCallback((nuevo: ItemNuevo): CartItem => {
    return {
      producto_id: nuevo.producto_id,
      nombre: nuevo.nombre,
      imagen: normalizarUrlImagen(nuevo.imagen, { carpeta: 'productos' }),
      talle: nuevo.talle,
      precio_unitario: nuevo.precio_unitario,
      cantidad: nuevo.cantidad ?? 1,
      stock_disponible: nuevo.stock_disponible,
      origen: nuevo.origen ?? 'individual',
      outfitId: nuevo.outfitId ?? null,
      outfitNombre: nuevo.outfitNombre ?? null,
      outfit_product_ids: nuevo.outfit_product_ids,
    }
  }, [])

  /** Construye los CartItem de todas las prendas de un combo. */
  const aCartItemsDeOutfit = useCallback(
    (
      outfitId: string,
      outfitNombre: string,
      prendas: PrendaOutfit[],
      detalle: Map<string, DetallePrenda>,
    ): CartItem[] => {
      const outfit_product_ids = prendas.map((p) => p.producto_id)
      return prendas.map((prenda) => {
        const info = detalle.get(prenda.producto_id)
        return {
          producto_id: prenda.producto_id,
          nombre: info?.nombre ?? '',
          imagen: normalizarUrlImagen(info?.imagen, { carpeta: 'productos' }),
          talle: prenda.talle,
          precio_unitario: info?.precio_unitario ?? 0,
          cantidad: 1,
          origen: 'outfit',
          outfitId,
          outfitNombre,
          outfit_product_ids,
        }
      })
    },
    [],
  )

  const insertar = useCallback(
    (item: CartItem) => {
      commit((prev) => agregarItem(prev, item))
    },
    [commit],
  )

  /**
   * Agrega un item (prenda individual o prenda de outfit) validando contra el
   * carrito actual. Si encuentra colisión NO muta el estado: devuelve las
   * colisiones para que la UI muestre el modal de advertencia.
   */
  const intentarAgregar = useCallback(
    (nuevo: ItemNuevo): ResultadoValidacion => {
      const item = aCartItem(nuevo)

      if (!item.outfitId) {
        const existente = itemsRef.current.find(
          (i) =>
            !i.outfitId &&
            i.producto_id === item.producto_id &&
            i.talle === item.talle,
        )

        if (existente) {
          const cap = capacidadStock(existente.stock_disponible, item.stock_disponible)
          if (Number.isFinite(cap) && existente.cantidad >= cap) {
            return {
              ok: false,
              colisiones: [],
              motivo: `No queda más stock de ${item.nombre} talle ${item.talle}.`,
            }
          }
          insertar(item)
          return { ok: true }
        }
      }

      const colisiones = detectarColisiones(itemsRef.current, [
        { producto_id: item.producto_id, talle: item.talle },
      ])
      if (colisiones.length > 0) return { ok: false, colisiones }

      insertar(item)
      return { ok: true }
    },
    [aCartItem, insertar],
  )

  /** Filtra del carrito todo lo que ocupaba el lugar de las colisiones. */
  const sanearConflictos = useCallback(
    (prev: CartItem[], colisiones: Colision[]) => {
      const outfitsARemover = new Set(idsOutfitsARemover(colisiones))
      const sueltosARemover = new Set(
        colisiones
          .filter((c) => !c.outfitEnCarritoId)
          .map((c) => claveVariante(c.itemEnCarrito.producto_id, c.itemEnCarrito.talle)),
      )
      return prev.filter((i) => {
        if (i.outfitId && outfitsARemover.has(i.outfitId)) return false
        if (!i.outfitId && sueltosARemover.has(claveVariante(i.producto_id, i.talle))) {
          return false
        }
        return true
      })
    },
    [],
  )

  /**
   * Reemplaza lo que entre en conflicto por el item nuevo. Si la colisión venía
   * de un outfit, se saca el outfit completo; si era una prenda suelta, se
   * elimina ese item puntual.
   */
  const reemplazarConflictosYAgregar = useCallback(
    (nuevo: ItemNuevo, colisiones: Colision[]) => {
      commit((prev) =>
        agregarItem(sanearConflictos(prev, colisiones), aCartItem(nuevo)),
      )
    },
    [aCartItem, commit, sanearConflictos],
  )

  /**
   * Agrega todas las prendas de un outfit como una sola unidad transaccional.
   * Devuelve las colisiones sin haber mutado nada si alguna prenda ya estaba.
   */
  const intentarAgregarOutfit = useCallback(
    (
      outfitId: string,
      outfitNombre: string,
      prendas: PrendaOutfit[],
      detalle: Map<string, DetallePrenda>,
    ): ResultadoValidacion => {
      const colisiones = detectarColisiones(itemsRef.current, prendas)

      if (colisiones.length > 0) return { ok: false, colisiones }

      commit((prev) => [...prev, ...aCartItemsDeOutfit(outfitId, outfitNombre, prendas, detalle)])
      return { ok: true }
    },
    [aCartItemsDeOutfit, commit],
  )

  /** Variante de outfit que reemplaza los conflictos y agrega el combo completo. */
  const reemplazarConflictosYAgregarOutfit = useCallback(
    (
      outfitId: string,
      outfitNombre: string,
      prendas: PrendaOutfit[],
      detalle: Map<string, DetallePrenda>,
      colisiones: Colision[],
    ) => {
      commit((prev) => [
        ...sanearConflictos(prev, colisiones),
        ...aCartItemsDeOutfit(outfitId, outfitNombre, prendas, detalle),
      ])
    },
    [aCartItemsDeOutfit, commit, sanearConflictos],
  )

  const eliminarItem = useCallback(
    (productoId: string, talle: string) => {
      commit((prev) => prev.filter((i) => !(i.producto_id === productoId && i.talle === talle)))
    },
    [commit],
  )

  const actualizarCantidad = useCallback(
    (productoId: string, talle: string, cantidad: number) => {
      commit((prev) =>
        prev.flatMap((item) => {
          if (item.outfitId || item.producto_id !== productoId || item.talle !== talle) {
            return [item]
          }

          const cap = capacidadStock(item.stock_disponible)
          const nueva = Math.min(Math.max(0, Math.floor(Number(cantidad) || 0)), cap)
          return nueva <= 0 ? [] : [{ ...item, cantidad: nueva }]
        }),
      )
    },
    [commit],
  )

  const removerOutfitCompleto = useCallback(
    (outfitId: string) => {
      if (!outfitId) return
      commit((prev) => prev.filter((i) => i.outfitId !== outfitId))
    },
    [commit],
  )

  const vaciar = useCallback(() => {
    itemsRef.current = []
    setItems([])
    setCupon(null)
  }, [])

  const aplicarCupon = useCallback((nuevo: CuponAplicado) => setCupon(nuevo), [])

  const quitarCupon = useCallback(() => setCupon(null), [])

  const total = useMemo(
    () => items.reduce((n, i) => n + i.cantidad * i.precio_unitario, 0),
    [items],
  )
  const count = useMemo(() => items.reduce((n, i) => n + i.cantidad, 0), [items])
  const resultadoPromociones = useMemo(
    () => calcularPromociones(items, promociones),
    [items, promociones],
  )
  const descuentoPromociones = resultadoPromociones.descuento
  const promocionesAplicadas = resultadoPromociones.aplicadas
  const subtotalPostPromociones = Math.max(0, total - descuentoPromociones)
  const descuentoCupon = useMemo(
    () => calcularDescuentoCupon(cupon, subtotalPostPromociones),
    [cupon, subtotalPostPromociones],
  )
  const descuentoOutfit = useMemo(
    () =>
      calcularDescuentoOutfit(
        items,
        outfits,
        DESCUENTO_OUTFIT_PCT,
        resultadoPromociones.unidadesConsumidas,
      ),
    [items, outfits, resultadoPromociones],
  )
  const totalConDescuento = useMemo(
    () =>
      Math.max(
        0,
        subtotalPostPromociones - descuentoOutfit - descuentoCupon,
      ),
    [subtotalPostPromociones, descuentoOutfit, descuentoCupon],
  )

  const value = useMemo(
    () => ({
      items,
      count,
      total,
      intentarAgregar,
      reemplazarConflictosYAgregar,
      intentarAgregarOutfit,
      reemplazarConflictosYAgregarOutfit,
      eliminarItem,
      actualizarCantidad,
      removerOutfitCompleto,
      vaciar,
      carritoAbierto,
      setCarritoAbierto,
      cupon,
      descuentoCupon,
      descuentoOutfit,
      descuentoPromociones,
      promocionesAplicadas,
      totalConDescuento,
      aplicarCupon,
      quitarCupon,
    }),
    [
      items,
      count,
      total,
      intentarAgregar,
      reemplazarConflictosYAgregar,
      intentarAgregarOutfit,
      reemplazarConflictosYAgregarOutfit,
      eliminarItem,
      actualizarCantidad,
      removerOutfitCompleto,
      vaciar,
      carritoAbierto,
      setCarritoAbierto,
      cupon,
      descuentoCupon,
      descuentoOutfit,
      descuentoPromociones,
      promocionesAplicadas,
      totalConDescuento,
      aplicarCupon,
      quitarCupon,
    ],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}