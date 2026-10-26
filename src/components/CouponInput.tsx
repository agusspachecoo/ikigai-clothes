import { useState } from 'react'
import { useCart } from '../context/cart'
import { aplicarCupon as validarCupon } from '../lib/cupones'

/** Campo para aplicar un cupón de descuento. Reutilizado en carrito y checkout. */
export function CouponInput({
  className = '',
  variant = 'default',
}: {
  className?: string
  variant?: 'default' | 'checkout'
}) {
  const { cupon, total, aplicarCupon, quitarCupon } = useCart()
  const [codigo, setCodigo] = useState('')
  const [estado, setEstado] = useState<'idle' | 'cargando' | 'error'>('idle')
  const [mensaje, setMensaje] = useState('')
  const esCheckout = variant === 'checkout'

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
    if (esCheckout) {
      return (
        <div
          className={`rounded-xl border border-success/25 bg-success/5 px-3 py-2.5 ${className}`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-xs">
              <span className="badge badge-sm badge-success shrink-0 font-semibold">
                {cupon.codigo}
              </span>
              <span className="truncate text-base-content/70">
                {cupon.descripcion ?? 'Cupón aplicado'}
              </span>
            </span>
            <button
              type="button"
              onClick={quitarCupon}
              className="shrink-0 text-xs font-medium underline underline-offset-2 opacity-60 transition-opacity hover:opacity-100"
            >
              Quitar
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className={`flex items-center justify-between gap-2 ${className}`}>
        <span className="flex items-center gap-2 text-xs min-w-0">
          <span className="badge badge-sm badge-primary shrink-0">{cupon.codigo}</span>
          <span className="opacity-70 truncate">{cupon.descripcion ?? 'Cupón aplicado'}</span>
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

  if (esCheckout) {
    return (
      <form onSubmit={enviar} className={className}>
        <label
          htmlFor="cupon-checkout"
          className="mb-1.5 block text-xs font-medium text-base-content/60"
        >
          Cupón de descuento
        </label>
        <div className="flex overflow-hidden rounded-xl border border-line/70 bg-base-100 transition-colors focus-within:border-neutral/40 focus-within:ring-2 focus-within:ring-neutral/10">
          <input
            id="cupon-checkout"
            type="text"
            value={codigo}
            onChange={(e) => {
              setCodigo(e.target.value.toUpperCase())
              if (estado === 'error') setEstado('idle')
            }}
            placeholder="Ingresá tu cupón"
            aria-invalid={estado === 'error'}
            className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-sm uppercase outline-none placeholder:text-base-content/35"
          />
          <button
            type="submit"
            disabled={estado === 'cargando' || !codigo.trim()}
            className="shrink-0 border-l border-line/70 px-4 text-xs font-semibold uppercase tracking-wide transition-colors hover:bg-base-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {estado === 'cargando' ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              'Aplicar'
            )}
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
          aria-invalid={estado === 'error'}
          /* min-w-0: sin esto el input conserva su ancho intrínseco de
             placeholder y empuja el botón fuera del drawer en pantallas
             angostas (flex-1 no baja de min-width: auto). */
          className="input input-sm flex-1 min-w-0 rounded-none border-r-0 bg-base-100 uppercase"
        />
        <button
          type="submit"
          disabled={estado === 'cargando' || !codigo.trim()}
          className="btn btn-sm btn-outline rounded-none px-4 shrink-0"
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
