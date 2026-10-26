// Compatibilidad: los tipos y helpers de envío viven en `enviopack.ts`.
//
// La cotización ya no se resuelve en el navegador. El precio sale de la Edge
// Function `cotizar-envio`, que firma cada opción para que `crear-orden` no
// acepte importes manipulados. Este módulo se mantiene solo como reexport para
// no tocar los imports existentes.
export type { OpcionEnvio, ResultadoCotizacion } from './enviopack'
export { ORIGEN_CP, claveOpcion, nombreTransporte } from './enviopack'
