# Ikigai Clothes - E-commerce

Tienda online de ropa urbana/deportiva. Stack: React + TypeScript + Vite + Tailwind CSS + DaisyUI + Supabase (+ Edge Functions) + Mercado Pago. Deploy en Vercel.

## Setup

```bash
npm install
cp .env.example .env.local   # completá los valores
npm run dev
```

## Variables de entorno

### Frontend (`.env.local` / Vercel)

| Variable | Descripción |
| --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase. |
| `VITE_SUPABASE_ANON_KEY` | Anon key pública de Supabase. |
| `VITE_MERCADOPAGO_PUBLIC_KEY` | Public key de Mercado Pago (producción). |
| `VITE_ENVIOPACK_API_KEY` | No se usa en el frontend. La credencial real vive en las Edge Functions (ver abajo). Se deja como referencia/placeholder. |
| `VITE_ENVIOPACK_ORIGEN_CP` | Código postal de despacho del local (origen). Se envía a la cotización y se guarda como metadata en el payload de envío de la orden. Si se omite, la Edge Function usa `ENVIOPACK_ORIGEN_CP` (default 3360). Se sigue aceptando la vieja `VITE_ZIPPIN_ORIGIN_CP` por compatibilidad. |
| `VITE_SHOWROOM_IMAGE_URL` | (opcional) Respaldo de la imagen del bloque de showroom. La fuente real es el panel (ver abajo); esta variable solo se usa si no se subió ninguna foto. |
| `VITE_SITE_URL` | Dominio canónico sin barra final, para canonical, Open Graph y sitemap. Si se omite se usa `https://ikigai-store-omega.vercel.app`. Debe coincidir con el secret `STORE_URL` de las Edge Functions. |
| `VITE_GA_ID` | (opcional) ID de Google Analytics 4 (`G-XXXXXXXXXX`). Si se omite, GA4 no se inyecta. Vercel Web Analytics se carga siempre, pero descarta los eventos hasta que el visitante acepta cookies. |

### Supabase Edge Functions (secrets, ver `supabase/functions/.env`)

| Secret | Descripción |
| --- | --- |
| `ENVIOPACK_API_KEY` / `ENVIOPACK_SECRET_KEY` | Credenciales de la cuenta EnvíoPack (autenticación con access_token contra `POST /auth`). |
| `ENVIOPACK_ORIGEN_CP` | (opcional) CP de despacho del local (default: `3360`, Oberá, Misiones). |
| `ENVIOPACK_PROVINCIA` | (opcional) Forzar provincia destino (ISO-3166-2:AR); si se omite se resuelve por CP. |
| `ENVIOPACK_DESPACHO` | (opcional) `D` retiro por domicilio (default) o `S` despacho desde sucursal. |
| `ANDREANI_USER` | Usuario de la API de Andreani PYME. |
| `ANDREANI_PASSWORD` | Password de la API de Andreani PYME. |
| `ANDREANI_CONTRATO` | Número de contrato con Andreani (se envía en el campo `contrato` de la cotización). Por requisito del negocio es el **DNI/CUIT registrado**: `46717557`. |
| `OCA_CUIT` | CUIT registrado en OCA para cotizar (formato `##-########-#`). Si falta, OCA devuelve tarifas nominales con el CUIT de prueba de su documentación. |
| `MERCADOPAGO_ACCESS_TOKEN` | Access Token de producción de Mercado Pago. |
| `SUPABASE_SERVICE_ROLE_KEY` | Inyectada por Supabase en producción; para local ver `supabase/functions/.env`. |

Los secrets se configuran con `supabase secrets set <NOMBRE>=<valor>`. Detalle de
la integración Andreani (incluido el fallback por contrato inválido) en
`supabase/functions/README.md`.

## Imagen del showroom (subida desde el panel)

- La foto del bloque de showroom (final de la home) se administra en
  **Panel → Configuración → Imagen del showroom**.
- Al elegir o arrastrar el archivo, `ImageUploader` comprime la imagen **en el
  navegador** antes de subirla: reescala a 1800 px de ancho, baja la calidad en
  pasos de 0.15 hasta 0.4 y, si todavía pesa demasiado, reduce el tamaño un 20 %
  por vuelta, con el objetivo de 320 KB. Sale en WebP (JPG si el navegador no
  lo soporta).
- El archivo comprimido sube al bucket `product-images`, en la carpeta
  `showroom/`. Al subir una foto nueva se borra la anterior de esa carpeta para no
  acumular versiones.
- La URL pública se guarda en `config_tienda.clave = 'imagen_showroom'` (migración
  `020_showroom.sql`) y el frontend la lee por `useTienda()`. Si está vacía, el
  bloque muestra un placeholder y se puede usar `VITE_SHOWROOM_IMAGE_URL` como
  respaldo.
- Los ajustes de compresión están en `COMPRESION_SHOWROOM`
  (`src/pages/admin/ConfigAdmin.tsx`) y en `src/lib/imageCompression.ts`, que es
  el helper que también usan productos, outfits, banners y reseñas.

## Imágenes y campos del panel (022)

La migración `022_comprobantes_privados_y_campos.sql` agrega tres columnas:

| Tabla | Columna | Para qué |
| --- | --- | --- |
| `productos` | `sku` | Código interno. La búsqueda del panel lo toma junto al nombre y la categoría, y la tabla lo muestra en mono bajo el nombre. Único e insensible a mayúsculas, ignorando vacíos, así que varios productos pueden quedar sin código. |
| `categorias` | `imagen_url` | Imagen representativa, subida en **Panel → Categorías** (alta o edición). Gana sobre la foto de Unsplash en la grilla de categorías del inicio (`CategoryGrid`). |
| `banners` | `imagen_mobile` | Versión vertical 9:16 de cada slide. |

Sobre los banners:

- En **Panel → Banners** cada slide tiene dos `ImageUploader`: Desktop (apaisado,
  hasta 1920 px / 350 KB) y Mobile (vertical 9:16, hasta 1080 px / 250 KB), para
  comparar el encuadre de los dos.
- `HeroCarousel` arma un `<picture>`: la fuente mobile gana hasta 767 px y la
  desktop a partir de 768 px. Si el slide no tiene imagen mobile, se usa la
  desktop en todos los tamaños.
- Las dos imágenes van a la carpeta `banners/` del bucket `product-images`, sin
  borrar la anterior al subir: `borrarAnterior` dejaría una sola imagen viva por
  carpeta y una de las dos se comería a la otra.

## Stock en el catálogo

Un producto sin stock sigue apareciendo en el catálogo, con badge y botón
deshabilitados:

- `sinStock` en `ProductCard`, `QuickshopModal` y `Producto` es
  `conStock.length === 0`, o sea que un producto al que nunca se le cargaron
  talles también cuenta como agotado.
- El badge y el botón dicen **"Sin Stock"**. En mobile el botón se ve igual que
  en el resto, pero deshabilitado, para que quede claro que la prenda existe.
- Por defecto el catálogo muestra todo: el filtro "solo con stock"
  (`soloConStock` en `src/lib/filtros.ts`) está apagado.

## Storage (imágenes y comprobantes)

Dos buckets, con permisos distintos porque el contenido también lo es:

| Bucket | `public` | Contenido | Quién escribe |
| --- | --- | --- | --- |
| `product-images` | `true` | catálogo, outfits, banners, categorías, fotos de reseñas y comunidad, imagen del showroom | Panel (`productos/`, `outfits/`, `banners/`, `categorias/`, `comunidad/`, `showroom/`) y cualquier visitante en `reviews/` |
| `comprobantes` | `false` | fotos de los comprobantes de transferencia | El propio comprador, sin cuenta (`comprobantes/`) |

`021_cierra_storage_publico.sql` saca la policy `Storage Permitir todo publico`
(era `ALL` para el rol `public` con `USING true`: cualquier visitante anónimo
podía escribir o borrar en cualquier bucket), y `022_comprobantes_privados_y_campos.sql`
cierra la lectura de comprobantes. Queda:

- **Lectura pública** de `product-images`, sin sesión: son fotos de catálogo.
- **Lectura de `comprobantes` solo para el panel.** El bucket es privado y la
  policy pública se eliminó: con el bucket privado nomás, la URL
  `/object/authenticated/...` seguía sirviendo el archivo a cualquiera que tuviera
  el path, que es lo que hace funcionar "Abrir en nueva pestaña".
- **Escritura anónima** solo en dos carpetas: `product-images/reviews/` (foto
  opcional de la reseña, que es un formulario abierto) y
  `comprobantes/comprobantes/` (checkout por transferencia, que es guest).
  Subir a un bucket privado no necesita que sea público.
- **Escritura del panel** (`INSERT`, `UPDATE`, `DELETE`) y **lectura de
  comprobantes** solo para `public.es_admin()`. Ojo: el frontend del panel usa
  la anon key, así que "autenticado" no alcanza como prueba de admin; cualquier
  cuenta registrada podría pisar el catálogo.

### Comprobantes en el panel

`ordenes.comprobante_url` guarda el **path** en Storage (ej.
`comprobantes/abc-1712.png`), no una URL pública. Al abrir el modal,
`comprobanteFirmado()` (`src/lib/adminApi.ts`) pide una signed URL de 5 minutos
con `createSignedUrl`; como la lectura exige `es_admin()`, solo el panel la
consigue. Las filas ya guardadas con la URL pública vieja se siguen abriendo:
`pathDeComprobante()` convierte la URL en path.

Para verificar los permisos con la anon key:

```bash
bash scripts/verificar-storage.sh
```

Esa corrida deja dos objetos de prueba de 16 bytes (uno por cada escritura
anónima que tiene que funcionar). Como probar que el anónimo **no** puede borrar
implica que no se puedan borrar con la anon key, se limpian con la service_role:

```bash
bash scripts/limpiar-storage-pruebas.sh
```

## Checkout: validaciones y datos de pago

`src/lib/validacion.ts` es la fuente única de reglas de formato. El checkout
valida en cada tecla y muestra el error de un campo recién después del primer
blur o de tipearlo (`tocados` en `src/pages/Checkout.tsx`), para no gritarle al
usuario que le faltan dígitos a mitad de escritura. Al enviar, todos los campos
se marcan como tocados y aparecen los errores pendientes de una sola vez.

| Campo | Regla | Acepta |
| --- | --- | --- |
| Nombre / Apellido | 2+ letras, sin números | `Joaquin`, `Leopolino` |
| Email | formato con `@` y dominio | `nombre@mail.com` |
| Teléfono | 10 u 11 dígitos, o `+54` + 10 | `1155551234` |
| DNI | 7 u 8 dígitos | `20467175` |
| Dirección | 2 palabras o más | `Urquiza 55` |
| Código Postal | 4 dígitos o CPA completo | `3360`, `N3360ABC` |

La dirección y el CP no se piden cuando se elige retiro en showroom.

Las mismas reglas están del lado del servidor en
`supabase/functions/crear-orden/index.ts`: el frontend es la primera barrera,
pero si alguien pega al endpoint tiene que recibir los mismos errores.

Sobre el pago:

- Los pasos de cada método viven en `PASOS_PAGO` (`src/lib/pagos.ts`) y se
  muestran dos veces: en el checkout, antes de confirmar, y en la pantalla de
  confirmación, como recordatorio. Así el cliente sabe qué va a pasar y después
  tiene la lista de lo que falta hacer.
- `DatosBancarios` (`src/components/DatosBancarios.tsx`) muestra la cuenta con
  botón de copiar en CBU, Alias e importe. Usa `useClipboard`, que cae a
  `execCommand('copy')` cuando no hay `navigator.clipboard` (HTTPS o navegador
  viejo) sin dejar el botón muerto justo en el celular.
- La pantalla de confirmación muestra el desglose completo (productos,
  descuentos, envío, total) con los importes que devolvió el servidor, el
  método de entrega, el número de pedido y el enlace de WhatsApp con el
  pedido precargado.

## Envíos

La cotización es local y estática: `src/lib/tarifasEnvio.ts` mapea el CP a un
tarifario por zona y peso, sin llamadas a carriers ni a Edge Functions. El
checkout muestra esas opciones y el retiro en showroom se modela como una opción
más, de costo 0 (`OPCION_SHOWROOM` en `src/pages/Checkout.tsx`).

El rango de envío se valida en el backend contra el total recalculado
(`crear-orden` y `create-preference` releen productos, stock y descuentos), así
que un precio de envío inventado desde el cliente no cambia el total que se cobra.

Los servicios OCA / Andreani / EnvíoPack quedaron en el repositorio como
referencia histórica; para volver a cotizar contra un carrier hay que restaurar
la llamada de red en `src/lib/enviopack.ts` y volver a desplegar la Edge Function
correspondiente.

## Deploy a Vercel

Configurar las variables `VITE_*` en el dashboard de Vercel (Project → Settings → Environment Variables)
y conectar el repositorio. Las Edge Functions se despliegan con `supabase functions deploy`.