import { useState } from 'react'
import { useCart } from '../context/cart'
import { aplicarCupon as validarCupon } from '../lib/cupones'

/** Campo para aplicar un cupón de descuento. Reutilizado en carrito y checkout. */
export function CouponInput({ className = '' }: { className?: string }) {
  const { cupon, total, aplicarCupon, quitarCupon } = useCart()
  const [codigo, setCodigo] = useState('')
  const [estado, setEstado] = useState<'idle' | 'cargando' | 'error'>('idle')
  const [mensaje, setMensaje] = useState('')

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    const limpio = codigo.trim().toUpperCase()
    if (!limpio) return

    setEstado('cargando')
    setMensaje('')
    const resultado = await validarCupon(limpio, total)

    if (!resultado.ok) {
      setEstado('error')
      setMensaje(resultado.motivo)
      return
    }

    aplicarCupon(resultado.cupon)
    setCodigo('')
    setEstado('idle')
  }

  if (cupon) {
    return (
      <div className={`flex items-center justify-between gap-2 ${className}`}>
        <span className="flex items-center gap-2 text-xs">
          <span className="badge badge-sm badge-primary">{cupon.codigo}</span>
          <span className="opacity-70">{cupon.descripcion ?? 'Cupón aplicado'}</span>
        </span>
        <button
          type="button"
          onClick={quitarCupon}
          className="text-xs underline opacity-70 hover:opacity-100"
        >
          Quitar
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className={className}>
      <div className="flex">
        <input
          type="text"
          value={codigo}
          onChange={(e) => {
            setCodigo(e.target.value.toUpperCase())
            if (estado === 'error') setEstado('idle')
          }}
          placeholder="Cupón de descuento"
          aria-label="Cupón de descuento"
          className="input input-sm flex-1 rounded-none border-r-0 bg-base-100 uppercase"
        />
        <button
          type="submit"
          disabled={estado === 'cargando' || !codigo.trim()}
          className="btn btn-sm btn-outline rounded-none px-4"
        >
          {estado === 'cargando' ? <span className="loading loading-spinner loading-xs" /> : 'Aplicar'}
        </button>
      </div>
      {estado === 'error' && (
        <p className="mt-1.5 text-xs text-error" role="alert">
          {mensaje}
        </p>
      )}
    </form>
  )
}
