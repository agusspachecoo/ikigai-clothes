import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useTienda } from '../context/tienda'

/** Formulario de suscripción al newsletter (inserción pública, ver migración 017). */
export function NewsletterForm({ className = '' }: { className?: string }) {
  const { email_contacto, nombre_tienda } = useTienda()
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState<'idle' | 'ok' | 'error'>('idle')
  const [mensaje, setMensaje] = useState('')

  async function suscribir(e: React.FormEvent) {
    e.preventDefault()
    const limpio = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) {
      setEstado('error')
      setMensaje('Revisá el email.')
      return
    }

    const { error } = await supabase
      .from('suscriptores_newsletter')
      .insert({ email: limpio })

    if (error) {
      setEstado('error')
      setMensaje(
        error.code === '23505'
          ? 'Ese email ya está suscrito.'
          : 'No pudimos suscribirte. Probá de nuevo.',
      )
      return
    }

    setEstado('ok')
    setMensaje('¡Listo! Gracias por suscribirte.')
    setEmail('')
  }

  return (
    <form onSubmit={suscribir} className={className}>
      <div className="flex">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (estado !== 'idle') setEstado('idle')
          }}
          placeholder="Email"
          aria-label="Email"
          className="input input-sm flex-1 rounded-none border-r-0 bg-base-100"
        />
        <button type="submit" className="btn btn-sm btn-primary rounded-none px-4">
          Enviar
        </button>
      </div>
      {estado !== 'idle' && (
        <p
          className={`mt-2 text-xs ${estado === 'ok' ? 'text-success' : 'text-error'}`}
          role="status"
        >
          {mensaje}
        </p>
      )}
      <p className="mt-2 text-xs opacity-60">
        Recibí las novedades de {nombre_tienda} por email. ¿Preferís hablar?{' '}
        <a href={`mailto:${email_contacto}`} className="underline">
          Escribinos
        </a>
        .
      </p>
    </form>
  )
}
