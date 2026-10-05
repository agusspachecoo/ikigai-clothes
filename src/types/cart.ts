export interface CartItem {
  producto_id: string
  nombre: string
  imagen: string
  talle: string
  precio_unitario: number
  cantidad: number
  origen?: 'individual' | 'outfit'
  outfitId?: string | null
  outfitNombre?: string | null
  /** Prendas que componen el outfit al que pertenece este item. */
  outfit_product_ids?: string[]
}
