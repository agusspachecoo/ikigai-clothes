# IKIGAI CLOTHES - Supabase Edge Functions (Mercado Pago)

Funciones para el pago con **Mercado Pago** (Checkout Pro) + webhook/IPN.

## Funciones
| Función | Descripción |
| --- | --- |
| `create-preference` | Crea la preferencia de pago en Mercado Pago con los ítems del carrito y los datos del cliente. Devuelve `preference_id` e `init_point`. |
| `mercadopago-webhook` | Recibe las notificaciones (IPN) de Mercado Pago, consulta el estado real del pago y actualiza la orden en Supabase a `pagado`. |

## Dónde configurar los tokens de Mercado Pago

1. **Obtener el Access Token** en el panel de desarrolladores de Mercado Pago:
   https://www.mercadopago.com.ar/developers → tus credenciales para la aplicación.
   Usá el **Access Token de producción** (`APP_USR-...`). Las de prueba (`TEST-...`) redirigen al sandbox.

2. **Configurar el secret en Supabase** (usado por las Edge Functions en la nube):
   ```bash
   supabase login
   supabase link --project-ref TUPROYECTOREF
   supabase secrets set MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxxxxxx
   ```

   También podés configurarlo desde la web: **Supabase Dashboard → Edge Functions → Secrets**.
   Además de `MERCADOPAGO_ACCESS_TOKEN`, configurá la URL de producción de la tienda:

   ```bash
   supabase secrets set STORE_URL=https://ikigai-store-omega.vercel.app
   ```

   > `STORE_URL` define las URLs de retorno de Mercado Pago (`.../checkout/success|failure|pending`).
   > Si no está configurada, la función usa las `back_urls` enviadas por el cliente solo si son URLs públicas (nunca `localhost`).

   > `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta la plataforma de Supabase automáticamente en producción.

3. **Deploy de las funciones**:
   ```bash
   supabase functions deploy create-preference
   supabase functions deploy mercadopago-webhook --no-verify-jwt
   ```
   - `create-preference` verifica JWT (el frontend envía la anon key en `apikey`/`Authorization`).
   - `mercadopago-webhook` se despliega con `--no-verify-jwt` porque Mercado Pago la invoca **sin** cabeceras de autorización. El webhook es seguro igualmente: re-consulta `GET /v1/payments/:id` en la API de MP y valida el monto antes de tocar la base.
   > Si las Edge Functions están desplegadas con verificación JWT por defecto, toda invocación sin `Authorization` responde **401**. En el Dashboard (Edge Functions → editar función) podés activar/desactivar "Verify JWT" por función.

4. **Desarrollo local** (opcional): creá un archivo `supabase/functions/.env`:
   ```
   MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxxxxxx
   SUPABASE_URL=https://TU-PROYECTO.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
   STORE_URL=http://localhost:5173
   ```
   y ejecutá:
   ```bash
   supabase start
   supabase functions serve create-preference --env-file supabase/functions/.env
   ```

## Migración de base de datos
Aplicá `supabase/migrations/004_mercadopago.sql` (SQL Editor de Supabase). Agrega a `ordenes`:
`mp_preference_id`, `mp_payment_id`, `mp_pago_detalle` y `updated_at`.

## Notas de seguridad
- El webhook **nunca confía en el body**: consulta `GET /v1/payments/{id}` con el Access Token y valida el monto contra `ordenes.monto_total` antes de actualizar.
- `create-preference` valida el total de los ítems contra el monto guardado en la base antes de crear la preferencia (evita manipulación de precios desde el cliente).
- La URL de notificación se genera desde `SUPABASE_URL`
  (`https://TU-PROYECTO.supabase.co/functions/v1/mercadopago-webhook`) y la pasa el frontend en cada creación de preferencia.
- Para producción, considerá verificar la firma `x-signature` del webhook. La re-consulta a la API de MP ya mitiga la mayor parte del riesgo.