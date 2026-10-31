const MIMES_HEIC = [
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
  'application/octet-stream',
]

const EXTENSIONES_HEIC = ['.heic', '.heif']

export function esHEIC(archivo: File): boolean {
  const tipo = (archivo.type || '').toLowerCase()
  if (MIMES_HEIC.includes(tipo)) return true

  const nombre = archivo.name.toLowerCase()
  return EXTENSIONES_HEIC.some((ext) => nombre.endsWith(ext))
}

export function esImagenSoportada(archivo: File): boolean {
  return (archivo.type || '').startsWith('image/') || esHEIC(archivo)
}

export async function convertirHEICaJPEG(archivo: File): Promise<File> {
  try {
    const heic2anyModule = await import('heic2any')
    const heic2any = (heic2anyModule.default ?? heic2anyModule) as any

    const salida = await heic2any({
      blob: archivo,
      toType: 'image/jpeg',
      quality: 0.85,
    })

    const blob = Array.isArray(salida) ? salida[0] : salida
    if (!blob) throw new Error('Blob inválido')

    const nombreBase = archivo.name.substring(0, archivo.name.lastIndexOf('.')) || 'imagen_iphone'
    return new File([blob], `${nombreBase}.jpg`, { type: 'image/jpeg' })
  } catch {
    throw new Error(
      `El archivo "${archivo.name}" está en formato HEIC y este navegador no puede decodificarlo. Por favor, subilo en formato JPG o PNG.`
    )
  }
}