import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { useSeo } from '../hooks/useSeo'
import { AuthAlert } from '../components/AuthAlert'
import { AuthField } from '../components/AuthField'

export function RestablecerPassword() {
  useSeo({ title: 'Restablecer contraseña · Ikigai Clothes', noindex: true })

  const { user, cargando, abrirAuthModal, cambiarPassword } = useAuth()
  const [password, setPassword] = useState('')
  const [repetir, setRepetir] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState(false)

  async function handleSubmit(e: FormEvent) {
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
    const res = await cambiarPassword(password)
    setGuardando(false)

    if (res.error) {
      setError(res.error)
      return
    }

    setPassword('')
    setRepetir('')
    setListo(true)
  }

  if (cargando) {
    return (
      <AuthPageShell>
        <div className="space-y-4">
          <div className="skeleton h-3 w-24 rounded-full" />
          <div className="skeleton h-8 w-2/3 rounded-lg" />
          <div className="skeleton h-4 w-full rounded-lg" />
          <div className="skeleton h-12 w-full rounded-xl" />
          <div className="skeleton h-12 w-full rounded-xl" />
          <div className="skeleton h-12 w-full rounded-xl" />
        </div>
      </AuthPageShell>
    )
  }

  if (!user) {
    return (
      <AuthPageShell>
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning/15">
            <svg
              className="h-7 w-7 text-warning"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM10.34 3.94l-7.5 13A1.5 1.5 0 004.14 19.5h15.72a1.5 1.5 0 001.3-2.56l-7.5-13a1.5 1.5 0 00-2.6 0z"
              />
            </svg>
          </div>
          <div className="mt-5">
            <AuthPageHeading
              center
              title="Enlace inválido o vencido"
              description="El enlace de recuperación ya no es válido. Pedí uno nuevo para definir tu contraseña."
            />
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              className="btn btn-primary h-11 rounded-xl"
              onClick={() => abrirAuthModal('recuperar')}
            >
              Pedir otro enlace
            </button>
            <Link to="/" className="btn btn-outline h-11 rounded-xl">
              Volver al inicio
            </Link>
          </div>
        </div>
      </AuthPageShell>
    )
  }

  if (listo) {
    return (
      <AuthPageShell>
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
            <svg
              className="h-7 w-7 text-success"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <div className="mt-5">
            <AuthPageHeading
              center
              title="Contraseña actualizada"
              description="Ya podés usar tu nueva contraseña para iniciar sesión."
            />
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link to="/perfil" className="btn btn-primary h-11 rounded-xl">
              Ir a mi perfil
            </Link>
            <Link to="/catalogo" className="btn btn-outline h-11 rounded-xl">
              Seguir comprando
            </Link>
          </div>
        </div>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell>
      <AuthPageHeading
        title="Definí tu nueva contraseña"
        description={
          <>
            Estás restableciendo la contraseña de{' '}
            <strong className="break-all font-semibold text-base-content">{user.email}</strong>.
          </>
        }
      />

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <AuthField
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          placeholder="Tu nueva contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="Mínimo 8 caracteres."
          required
        />

        <AuthField
          label="Repetí la nueva contraseña"
          type="password"
          autoComplete="new-password"
          placeholder="Repetí tu nueva contraseña"
          value={repetir}
          onChange={(e) => setRepetir(e.target.value)}
          required
        />

        {error && <AuthAlert>{error}</AuthAlert>}

        <button
          type="submit"
          className="btn btn-primary btn-block h-12 rounded-xl text-sm font-semibold tracking-wide shadow-sm transition-all duration-200 hover:bg-neutral-800 hover:shadow-md disabled:opacity-60"
          disabled={guardando}
        >
          {guardando ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            'Guardar nueva contraseña'
          )}
        </button>
      </form>

      <p className="mt-5 border-t border-line/50 pt-4 text-center text-[11px] leading-relaxed text-base-content/55">
        Por seguridad, te recomendamos usar una contraseña que no utilices en otros sitios.
      </p>
    </AuthPageShell>
  )
}

function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:py-20">
      <div className="rounded-3xl border border-line/60 bg-base-100 p-6 shadow-xl sm:p-8">
        {children}
      </div>
    </div>
  )
}

function AuthPageHeading({
  title,
  description,
  center = false,
}: {
  title: string
  description?: ReactNode
  center?: boolean
}) {
  return (
    <div className={center ? 'text-center' : undefined}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-base-content/35">
        Ikigai Clothes
      </p>
      <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h1>
      {description && (
        <p
          className={`mt-2 text-sm leading-relaxed text-base-content/60 ${
            center ? 'mx-auto max-w-sm' : ''
          }`}
        >
          {description}
        </p>
      )}
    </div>
  )
}
