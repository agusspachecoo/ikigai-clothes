import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { formatearPrecio } from '../../lib/precios'
import type { Cupon } from '../../types/database'

const VACIO = {
  codigo: '',
  descripcion: '',
  tipo: 'porcentaje' as Cupon['tipo'],
  valor: '',
  descuento_maximo: '',
  minimo_compra: '',
  usos_max: '',
  fecha_fin: '',
}

type FormCupon = typeof VACIO

function aNumero(v: string) {
  return v.trim() === '' ? null : Number(v)
}

function fechaAISO(v: string) {
  if (!v) return null
  return new Date(`${v}T23:59:59`).toISOString()
}

export function CuponesAdmin() {
  const [cupones, setCupones] = useState<Cupon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notificacion, setNotificacion] = useState<string | null>(null)
  const [form, setForm] = useState<FormCupon>(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)

  async function cargar() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('cupones')
      .select('*')
      .order('created_at', { ascending: false })
    setCupones((data ?? []) as Cupon[])
    setError(err?.message ?? null)
    setLoading(false)
  }

  useEffect(() => {
    let activo = true
    void (async () => {
      await Promise.resolve()
      await cargar()
      if (!activo) return
    })()
    return () => {
      activo = false
    }
  }, [])

  useEffect(() => {
    if (!notificacion) return
    const t = window.setTimeout(() => setNotificacion(null), 2500)
    return () => window.clearTimeout(t)
  }, [notificacion])

  function editar(c: Cupon) {
    setEditando(c.id)
    setErrorForm(null)
    setForm({
      codigo: c.codigo,
      descripcion: c.descripcion ?? '',
      tipo: c.tipo,
      valor: String(c.valor),
      descuento_maximo: c.descuento_maximo != null ? String(c.descuento_maximo) : '',
      minimo_compra: String(c.minimo_compra ?? 0),
      usos_max: c.usos_max != null ? String(c.usos_max) : '',
      fecha_fin: c.fecha_fin ? c.fecha_fin.slice(0, 10) : '',
    })
  }

  function limpiar() {
    setEditando(null)
    setForm(VACIO)
    setErrorForm(null)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setErrorForm(null)

    const codigo = form.codigo.trim().toUpperCase()
    const valor = Number(form.valor)

    if (!codigo) return setErrorForm('Ingresá un código.')
    if (!Number.isFinite(valor) || valor <= 0) return setErrorForm('Ingresá un valor mayor a 0.')
    if (form.tipo === 'porcentaje' && valor > 100) {
      return setErrorForm('El porcentaje no puede superar 100.')
    }

    const payload = {
      codigo,
      descripcion: form.descripcion.trim() || null,
      tipo: form.tipo,
      valor,
      descuento_maximo: aNumero(form.descuento_maximo),
      minimo_compra: aNumero(form.minimo_compra) ?? 0,
      usos_max: aNumero(form.usos_max),
      fecha_fin: fechaAISO(form.fecha_fin),
    }

    setGuardando(true)
    const { error: err } = editando
      ? await supabase.from('cupones').update(payload).eq('id', editando)
      : await supabase.from('cupones').insert(payload)
    setGuardando(false)

    if (err) {
      setErrorForm(
        err.code === '23505' ? 'Ya existe un cupón con ese código.' : err.message,
      )
      return
    }

    setNotificacion(editando ? 'Cupón actualizado' : 'Cupón creado')
    limpiar()
    void cargar()
  }

  async function alternarActivo(c: Cupon) {
    const { error: err } = await supabase
      .from('cupones')
      .update({ activo: !c.activo })
      .eq('id', c.id)
    if (err) setNotificacion(`Error: ${err.message}`)
    else setNotificacion(c.activo ? 'Cupón desactivado' : 'Cupón activado')
    void cargar()
  }

  async function eliminar(c: Cupon) {
    if (!window.confirm(`¿Eliminar el cupón ${c.codigo}?`)) return
    const { error: err } = await supabase.from('cupones').delete().eq('id', c.id)
    if (err) setNotificacion(`Error: ${err.message}`)
    else {
      setNotificacion('Cupón eliminado')
      if (editando === c.id) limpiar()
    }
    void cargar()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Cupones</h1>
        {editando && (
          <button className="btn btn-xs btn-ghost" onClick={limpiar}>
            Cancelar edición
          </button>
        )}
      </div>

      {notificacion && <div className="alert alert-success text-sm mb-4">{notificacion}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card bg-base-100 shadow-sm">
          {error ? (
            <div className="p-4">
              <div className="alert alert-error text-sm">{error}</div>
            </div>
          ) : loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-12 w-full" />
              ))}
            </div>
          ) : cupones.length === 0 ? (
            <p className="p-6 text-sm opacity-60">Todavía no hay cupones.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descuento</th>
                    <th>Condiciones</th>
                    <th>Usos</th>
                    <th>Estado</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cupones.map((c) => (
                    <tr key={c.id} className={c.activo ? '' : 'opacity-50'}>
                      <td>
                        <span className="font-mono font-semibold">{c.codigo}</span>
                        {c.descripcion && (
                          <p className="text-xs opacity-60">{c.descripcion}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        {c.tipo === 'porcentaje' ? `${c.valor}%` : `$${formatearPrecio(c.valor)}`}
                        {c.descuento_maximo != null && c.tipo === 'porcentaje' && (
                          <p className="text-xs opacity-60">
                            máx ${formatearPrecio(c.descuento_maximo)}
                          </p>
                        )}
                      </td>
                      <td className="text-xs opacity-70">
                        {Number(c.minimo_compra) > 0 && (
                          <p>Mín. ${formatearPrecio(c.minimo_compra)}</p>
                        )}
                        {c.fecha_fin && <p>Hasta {c.fecha_fin.slice(0, 10)}</p>}
                        {!Number(c.minimo_compra) && !c.fecha_fin && <p>—</p>}
                      </td>
                      <td className="whitespace-nowrap">
                        {c.usos}
                        {c.usos_max != null && ` / ${c.usos_max}`}
                      </td>
                      <td>
                        <span
                          className={`badge badge-sm ${
                            c.activo ? 'badge-success' : 'badge-ghost'
                          }`}
                        >
                          {c.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <button className="btn btn-xs btn-ghost" onClick={() => editar(c)}>
                          Editar
                        </button>
                        <button className="btn btn-xs btn-ghost" onClick={() => alternarActivo(c)}>
                          {c.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          className="btn btn-xs btn-ghost text-error"
                          onClick={() => eliminar(c)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <form onSubmit={guardar} className="card bg-base-100 shadow-sm p-5 h-fit space-y-4">
          <h2 className="font-bold">{editando ? 'Editar cupón' : 'Nuevo cupón'}</h2>

          <label className="form-control">
            <span className="label-text text-sm mb-1">Código</span>
            <input
              type="text"
              className="input input-bordered uppercase"
              placeholder="BIENVENIDA10"
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
            />
          </label>

          <label className="form-control">
            <span className="label-text text-sm mb-1">Descripción</span>
            <input
              type="text"
              className="input input-bordered"
              placeholder="Oferta de bienvenida"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="form-control">
              <span className="label-text text-sm mb-1">Tipo</span>
              <select
                className="select select-bordered"
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as Cupon['tipo'] })}
              >
                <option value="porcentaje">Porcentaje</option>
                <option value="fijo">Monto fijo</option>
              </select>
            </label>

            <label className="form-control">
              <span className="label-text text-sm mb-1">
                Valor {form.tipo === 'porcentaje' ? '(%)' : '($)'}
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                className="input input-bordered"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="form-control">
              <span className="label-text text-sm mb-1">Máx. descuento</span>
              <input
                type="number"
                min={0}
                className="input input-bordered"
                placeholder="Sin tope"
                value={form.descuento_maximo}
                onChange={(e) => setForm({ ...form, descuento_maximo: e.target.value })}
              />
            </label>

            <label className="form-control">
              <span className="label-text text-sm mb-1">Mín. compra</span>
              <input
                type="number"
                min={0}
                className="input input-bordered"
                placeholder="0"
                value={form.minimo_compra}
                onChange={(e) => setForm({ ...form, minimo_compra: e.target.value })}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="form-control">
              <span className="label-text text-sm mb-1">Usos máximos</span>
              <input
                type="number"
                min={0}
                className="input input-bordered"
                placeholder="Ilimitado"
                value={form.usos_max}
                onChange={(e) => setForm({ ...form, usos_max: e.target.value })}
              />
            </label>

            <label className="form-control">
              <span className="label-text text-sm mb-1">Válido hasta</span>
              <input
                type="date"
                className="input input-bordered"
                value={form.fecha_fin}
                onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
              />
            </label>
          </div>

          {errorForm && <div className="alert alert-error text-sm">{errorForm}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={guardando}>
            {guardando ? (
              <span className="loading loading-spinner loading-sm" />
            ) : editando ? (
              'Guardar cambios'
            ) : (
              'Crear cupón'
            )}
          </button>

          <p className="text-xs opacity-60">
            El descuento se valida en el servidor al iniciar el pago y se vuelve a calcular contra
            el monto de la orden.
          </p>
        </form>
      </div>
    </div>
  )
}
