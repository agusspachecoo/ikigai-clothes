import { useState } from 'react'
import { Outlet, NavLink, Link } from 'react-router-dom'
import { iniciarSesionAdmin, salirAdmin, useEsAdmin } from '../lib/admin'

const TABS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/productos', label: 'Productos' },
  { to: '/admin/outfits', label: 'Outfits' },
  { to: '/admin/categorias', label: 'Categorías' },
  { to: '/admin/banners', label: 'Banners' },
  { to: '/admin/pedidos', label: 'Pedidos' },
  { to: '/admin/resenas', label: 'Reseñas' },
  { to: '/admin/comunidad', label: 'Comunidad' },
  { to: '/admin/cupones', label: 'Cupones' },
  { to: '/admin/newsletter', label: 'Newsletter' },
  { to: '/admin/config', label: 'Configuración' },
]

export function AdminLayout() {
  const { user, esAdmin, cargando } = useEsAdmin()

  if (cargando) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  if (!user) return <AdminLogin />

  if (!esAdmin) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
        <div className="card bg-base-100 w-full max-w-sm">
          <div className="card-body">
            <h1 className="font-bold text-lg">Sin acceso</h1>
            <p className="text-sm opacity-70">
              Iniciaste sesión como <span className="font-medium">{user.email}</span>, pero esa
              cuenta no es administradora.
            </p>
            <div className="card-actions mt-2">
              <button
                onClick={() => void salirAdmin()}
                className="btn btn-outline btn-sm"
              >
                Cambiar de cuenta
              </button>
              <Link to="/" className="btn btn-ghost btn-sm">
                Volver a la tienda
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base-200">
      <div className="flex flex-col lg:flex-row">
        {/* Sidebar */}
        <aside className="w-full lg:w-64 shrink-0 bg-base-100 border-b lg:border-b-0 lg:border-r border-base-300">
          <div className="p-5 flex items-center justify-between lg:block">
            <div className="flex flex-col leading-none">
              <span className="text-xl font-black tracking-tight text-primary">IKIGAI</span>
              <span className="text-[0.6rem] font-semibold tracking-[0.35em] uppercase opacity-50">
                Panel Admin
              </span>
            </div>
            <button
              onClick={() => void salirAdmin()}
              className="btn btn-ghost btn-sm lg:mt-5"
            >
              Cerrar sesión
            </button>
          </div>

          <nav className="p-3 lg:pt-0">
            <ul className="menu menu-sm lg:menu-md rounded-xl p-0 lg:p-2">
              {TABS.map((tab) => (
                <li key={tab.to}>
                  <NavLink
                    to={tab.to}
                    end={tab.end}
                    className={({ isActive }) =>
                      isActive ? 'bg-primary text-primary-content font-semibold' : 'opacity-75 hover:bg-base-200'
                    }
                  >
                    {tab.label}
                  </NavLink>
                </li>
              ))}
              <li className="mt-2 border-t border-base-300 pt-2">
                <Link to="/" className="opacity-75 hover:bg-base-200">
                  Volver a la tienda
                </Link>
              </li>
            </ul>
          </nav>
        </aside>

        {/* Contenido */}
        <main className="flex-1 p-4 md:p-8 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    const { error: err } = await iniciarSesionAdmin(email, password)
    setCargando(false)
    if (err) setError(err)
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="card bg-base-100 shadow-xl w-full max-w-sm">
        <div className="card-body">
          <div className="flex flex-col leading-none mb-6">
            <span className="text-3xl font-black tracking-tight text-primary">IKIGAI</span>
            <span className="text-[0.6rem] font-semibold tracking-[0.35em] uppercase opacity-50 mt-1">
              Panel Administrativo
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="input input-bordered flex items-center gap-2">
              <svg className="h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <input
                type="email"
                className="grow"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </label>

            <label className="input input-bordered flex items-center gap-2">
              <svg className="h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <input
                type="password"
                className="grow"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>

            {error && <div className="alert alert-error text-sm">{error}</div>}

            <button type="submit" className="btn btn-primary btn-block" disabled={cargando}>
              {cargando ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                'Ingresar'
              )}
            </button>
          </form>

          <p className="text-xs opacity-50 mt-4 text-center">
            Solo pueden ingresar las cuentas marcadas como administradoras.
          </p>
        </div>
      </div>
    </div>
  )
}