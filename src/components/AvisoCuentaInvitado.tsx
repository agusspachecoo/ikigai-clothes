import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { supabase } from '../lib/supabase'
import type { ResultadoCuentaInvitado } from '../lib/cuentaInvitado'

export function AvisoCuentaInvitado({ resultado }: { resultado: ResultadoCuentaInvitado | null }) {
  const { user, abrirAuthModal } = useAuth()
  const sesionActiva = resultado?.sesionIniciada === true && !!user
  const [abierto, setAbierto] = useState(false)
  const [password, setPassword] = useState('')
  const [repetir, setRepetir] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardada, setGuardada] = useState(false)

  if (!resultado || resultado.estado === 'ya-logueado') return null

  if (resultado.estado === 'error') {
    return (
      <div className="alert alert-error alert-soft items-start">
        <span className="text-sm">
          {resultado.error || 'No pudimos crear tu cuenta automáticamente.'} Guardá el número de
          pedido para hacer seguimiento.
        </span>
      </div>
    )
  }

  if (resultado.estado === 'existente') {
    return (
      <div className="alert alert-warning alert-soft items-start">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full">
          <span className="text-sm">
            Ya tenías una cuenta con <strong>{resultado.email}</strong>. Iniciá sesión para ver este
            pedido en tu perfil.
          </span>
          <button className="btn btn-sm btn-warning shrink-0" onClick={() => abrirAuthModal()}>
            Iniciar sesión
          </button>
        </div>
      </div>
    )
  }

  async function definirPassword(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== repetir) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setGuardando(true)
    const { error: errPassword } = await supabase.auth.updateUser({ password })
    setGuardando(false)

    if (errPassword) {
      setError(errPassword.message)
      return
    }

    setGuardada(true)
    setAbierto(false)
    setPassword('')
    setRepetir('')
  }

  return (
    <div className="alert alert-success alert-soft items-start">
      <div className="w-full">
        <p className="text-sm">
          Creamos tu cuenta automáticamente con <strong>{resultado.email}</strong>.
          {sesionActiva
            ? ' Ya iniciaste sesión y podés ver este pedido en tu perfil.'
            : ' Iniciá sesión para ver este pedido en tu perfil.'}
        </p>

        {sesionActiva ? (
          <div className="mt-3">
            {guardada ? (
              <p className="text-sm font-medium">
                Contraseña guardada. Ya podés volver a entrar cuando quieras.
              </p>
            ) : abierto ? (
              <form onSubmit={definirPassword} className="space-y-3 max-w-sm">
                <input
                  type="password"
                  className="input input-bordered input-sm w-full"
                  placeholder="Nueva contraseña"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <input
                  type="password"
                  className="input input-bordered input-sm w-full"
                  placeholder="Repetir contraseña"
                  autoComplete="new-password"
                  value={repetir}
                  onChange={(e) => setRepetir(e.target.value)}
                />
                {error && <p className="text-xs text-error">{error}</p>}
                <div className="flex gap-2">
                  <button type="submit" className="btn btn-sm btn-success" disabled={guardando}>
                    {guardando ? <span className="loading loading-spinner loading-xs" /> : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setAbierto(false)
                      setError(null)
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <button className="btn btn-sm btn-success" onClick={() => setAbierto(true)}>
                Definir contraseña
              </button>
            )}
          </div>
        ) : (
          <div className="mt-3">
            <button className="btn btn-sm btn-success" onClick={() => abrirAuthModal()}>
              Iniciar sesión
            </button>
          </div>
        )}

        {sesionActiva && (
          <Link to="/perfil" className="btn btn-sm btn-ghost mt-2">
            Ver mis pedidos
          </Link>
        )}
      </div>
    </div>
  )
}
