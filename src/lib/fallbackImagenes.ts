import { IMAGEN_FALLBACK, normalizarUrlImagen } from './imagenes'

let instalado = false

/**
 * Red de seguridad para `<img>` que no usan `ImagenSegura` (por ejemplo los
 * archivos históricos protegidos). No reemplaza al componente: solo evita el
 * ícono de imagen rota cuando una URL falla.
 */
export function instalarFallbackGlobalImagenes(): () => void {
  if (instalado || typeof document === 'undefined') return () => {}
  instalado = true

  function alFallar(event: Event) {
    const target = event.target
    if (!(target instanceof HTMLImageElement)) return
    if (target.dataset.localFallback === '1') return
    if (target.dataset.fallbackGlobal === '1') return

    const actual = target.getAttribute('src') ?? ''
    const normalizada = normalizarUrlImagen(actual)

    if (normalizada !== actual && target.dataset.urlNormalizada !== '1') {
      target.dataset.urlNormalizada = '1'
      target.removeAttribute('srcset')
      target.src = normalizada
      return
    }

    target.dataset.fallbackGlobal = '1'
    target.removeAttribute('srcset')
    target.src = IMAGEN_FALLBACK
  }

  function alCargar(event: Event) {
    const target = event.target
    if (!(target instanceof HTMLImageElement)) return
    delete target.dataset.fallbackGlobal
    delete target.dataset.urlNormalizada
  }

  document.addEventListener('error', alFallar, true)
  document.addEventListener('load', alCargar, true)

  return () => {
    document.removeEventListener('error', alFallar, true)
    document.removeEventListener('load', alCargar, true)
    instalado = false
  }
}
