import { useEffect, useMemo, useState } from 'react'

export interface Countdown {
  dias: number
  horas: number
  minutos: number
  segundos: number
  totalMs: number
  terminado: boolean
}

const CERO: Countdown = { dias: 0, horas: 0, minutos: 0, segundos: 0, totalMs: 0, terminado: true }

function calcular(objetivo: number): Countdown {
  if (!Number.isFinite(objetivo)) return CERO

  const diff = objetivo - Date.now()
  if (diff <= 0) return CERO

  const totalSeg = Math.floor(diff / 1000)
  return {
    dias: Math.floor(totalSeg / 86400),
    horas: Math.floor((totalSeg % 86400) / 3600),
    minutos: Math.floor((totalSeg % 3600) / 60),
    segundos: totalSeg % 60,
    totalMs: diff,
    terminado: false,
  }
}

/** Cuenta regresiva a una fecha ISO. Se actualiza cada segundo. */
export function useCountdown(fecha: string | null | undefined): Countdown {
  const objetivo = useMemo(() => (fecha ? new Date(fecha).getTime() : NaN), [fecha])
  const [estado, setEstado] = useState<Countdown>(() => calcular(objetivo))

  useEffect(() => {
    if (!Number.isFinite(objetivo) || objetivo - Date.now() <= 0) return

    const id = window.setInterval(() => {
      const siguiente = calcular(objetivo)
      setEstado(siguiente)
      if (siguiente.terminado) window.clearInterval(id)
    }, 1000)

    return () => window.clearInterval(id)
  }, [objetivo])

  return estado
}
