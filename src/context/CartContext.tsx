import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { CartItem } from '../types/cart'
import { CartContext, type DetallePrenda, type ItemNuevo, type ResultadoValidacion } from './cart'
import { supabase } from '../lib/supabase'
import type { CuponAplicado } from '../lib/cupones'
import { calcularDescuentoCupon } from '../lib/cupones'
import { calcularDescuentoOutfit, type OutfitComposicion } from '../lib/outfits'
import { detectarColisiones, idsOutfitsARemover, type Colision } from '../lib/conflictos'

const STORAGE_KEY = 'ikigai-cart'
const CUPON_STORAGE_KEY = 'ikigai-cupon'

/** Prenda tal como la define el outfit, con el talle elegido en el modal. */
type PrendaOutfit = { producto_id: string; talle: string }

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as CartItem[]) : []
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
      imagen: nuevo.imagen,
      talle: nuevo.talle,
      precio_unitario: nuevo.precio_unitario,
      cantidad: nuevo.cantidad ?? 1,
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
          imagen: info?.imagen ?? '',
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

  /**
   * Inserción de una prenda ya validada. Como el stock es unitario, si la fila
   * ya existe se reemplaza en vez de acumular cantidad.
   */
  const insertar = useCallback(
    (item: CartItem) => {
      commit((prev) => {
        const existe = prev.some(
          (i) =>
            i.producto_id === item.producto_id &&
            i.talle === item.talle &&
            i.outfitId === item.outfitId,
        )
        if (existe === false) return [...prev, { ...item, cantidad: 1 }]
        return prev.map((i) =>
          i.producto_id === item.producto_id &&
          i.talle === item.talle &&
          i.outfitId === item.outfitId
            ? { ...item, cantidad: 1 }
            : i,
        )
      })
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
      const colisiones = detectarColisiones(itemsRef.current, {
        producto_id: nuevo.producto_id,
        outfitId: nuevo.outfitId ?? null,
        outfit_product_ids: nuevo.outfit_product_ids,
      })
      if (colisiones.length > 0) return { ok: false, colisiones }
      insertar(aCartItem(nuevo))
      return { ok: true }
    },
    [aCartItem, insertar],
  )

  /** Filtra del carrito todo lo que ocupaba el lugar de las colisiones. */
  const sanearConflictos = useCallback(
    (prev: CartItem[], colisiones: Colision[]) => {
      const outfitsARemover = new Set(idsOutfitsARemover(colisiones))
      // Prenda suelta en conflicto: se identifica solo por product_id, porque
      // el stock es unitario y el talle ya no exime de la colisión.
      const sueltosARemover = new Set(
        colisiones.filter((c) => !c.outfitEnCarritoId).map((c) => c.producto_id),
      )
      return prev.filter((i) => {
        if (i.outfitId && outfitsARemover.has(i.outfitId)) return false
        if (!i.outfitId && sueltosARemover.has(i.producto_id)) return false
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
      commit((prev) => {
        const base = sanearConflictos(prev, colisiones)
        const nuevoItem = aCartItem(nuevo)
        return [...base, { ...nuevoItem, cantidad: 1 }]
      })
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
      const outfit_product_ids = prendas.map((p) => p.producto_id)
      const existentes = itemsRef.current

      // Una misma prenda del carrito puede aparecer como colisión de varias
      // prendas del combo (por el aplanado). Se deduplica para avisar una vez.
      const colisiones: Colision[] = []
      const vistas = new Set<string>()
      for (const prenda of prendas) {
        for (const c of detectarColisiones(existentes, {
          producto_id: prenda.producto_id,
          outfitId,
          outfit_product_ids,
        })) {
          const clave = `${c.itemEnCarrito.producto_id}::${c.itemEnCarrito.talle}::${c.outfitEnCarritoId ?? ''}`
          if (vistas.has(clave)) continue
          vistas.add(clave)
          colisiones.push(c)
        }
      }

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
  const descuentoCupon = useMemo(() => calcularDescuentoCupon(cupon, total), [cupon, total])
  const descuentoOutfit = useMemo(
    () => calcularDescuentoOutfit(items, outfits),
    [items, outfits],
  )
  const totalConDescuento = useMemo(
    () => Math.max(0, total - descuentoOutfit - descuentoCupon),
    [total, descuentoOutfit, descuentoCupon],
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
      removerOutfitCompleto,
      vaciar,
      carritoAbierto,
      setCarritoAbierto,
      cupon,
      descuentoCupon,
      descuentoOutfit,
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
      removerOutfitCompleto,
      vaciar,
      carritoAbierto,
      setCarritoAbierto,
      cupon,
      descuentoCupon,
      descuentoOutfit,
      totalConDescuento,
      aplicarCupon,
      quitarCupon,
    ],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}