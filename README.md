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

## Envíos con OCA (activo) y Andreani/EnvíoPack (anteriores)

- El frontend (`src/lib/enviopack.ts`) llama a la Edge Function `oca-envio` con
  `{ postal_code, weight, height, width, length, bultos, valor_declarado }` (peso en kg).
- La función cotiza directamente contra el Web Service público de OCA
  `Tarifar_Envio_Corporativo` (plataforma e-Pak) enviando el **CUIT** en el campo `Cuit`.
  No exige credenciales de usuario; con el CUIT del local devuelve las tarifas vigentes.
- Devuelve las opciones de OCA (a domicilio y a sucursal) normalizadas con
  `id_servicio`, nombre, costo y tiempo estimado, en el mismo formato que el checkout espera.
- El checkout muestra las opciones, actualiza el total al seleccionar y guarda en `ordenes.envio_detalle`
  (jsonb) el método elegido, el CP destino, el CP de origen y el payload completo de la cotización.
- Las integraciones anteriores (`andreani-envio`, `enviopack-envio`) quedaron en el repositorio;
  para volver a usarlas solo hay que cambiar la constante `ENDPOINT_ENVIO` en `src/lib/enviopack.ts`.

## Deploy a Vercel

Configurar las variables `VITE_*` en el dashboard de Vercel (Project → Settings → Environment Variables)
y conectar el repositorio. Las Edge Functions se despliegan con `supabase functions deploy`.