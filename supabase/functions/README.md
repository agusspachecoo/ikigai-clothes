# IKIGAI CLOTHES - Supabase Edge Functions (Mercado Pago)

Funciones para el pago con **Mercado Pago** (Checkout Pro) + webhook/IPN.

## Funciones
| Función | Descripción |
| --- | --- |
| `crear-orden` | **Única vía para crear una orden.** Recalcula en el servidor el subtotal (leyendo `productos`), el descuento por transferencia y el envío gratis (desde `config_tienda`) y el cupón, e inserta `ordenes` + `orden_items` con `service_role`. El cliente NO envía `monto_total` ni descuentos: se ignoran. Devuelve el desglose real (`monto_total`, `subtotal`, `descuento_transferencia`, `descuento_cupon`, `costo_envio`, `envio_gratis`). |
| `create-preference` | Crea la preferencia de pago en Mercado Pago. Ignora el `precio_unitario` del cliente y relee los precios de `productos`; el costo de envío lo toma de `ordenes.costo_envio` (ya validado por `crear-orden`), no del body. Rechaza órdenes cuyo `metodo_pago` no sea `mercadopago`. Devuelve `preference_id` e `init_point`. |
| `mercadopago-webhook` | Recibe las notificaciones (IPN) de Mercado Pago, consulta el estado real del pago, actualiza la orden en Supabase a `pagado` y **descuenta el stock** de las prendas del pedido. |
| `zippin-envio` | Cotiza el envío de un pedido contra Zipnova (ex Zippin). Recibe un código postal destino y los ítems del carrito, y devuelve las opciones de transporte disponibles (Andreani, Correo Argentino, etc.) con costo y tiempo estimado. |
| `enviopack-envio` | Cotiza el envío contra la API de EnvíoPack (`GET /cotizar/costo`) y devuelve los carriers disponibles normalizados con el mismo formato que el frontend espera. |
| `andreani-envio` | Cotiza el envío **directamente** contra la API de Andreani PYME (`https://apis.andreani.com`) enviando el DNI/CUIT registrado en el campo `contrato`. Respuesta en el mismo formato uniforme del frontend. |
| `oca-envio` | Cotiza el envío **directamente** contra el Web Service público de OCA `Tarifar_Envio_Corporativo` (webservice de e-Pak). Solo necesita un CUIT registrado (sin credenciales de usuario) y devuelve las opciones de OCA (a domicilio y a sucursal) en el mismo formato uniforme. |

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
   supabase secrets set STORE_URL=https://ikigai-clothes.vercel.app
   ```

   > `STORE_URL` define la URL de producción de la tienda y también las URLs de retorno de Mercado Pago
   > (success/failure/pending → apuntan a la raíz `STORE_URL/`, sin subrutas para evitar 404).
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

## Cotización de envíos con Zipnova (ex Zippin)

La función `zippin-envio` consume la API de Zipnova (`POST https://api.zipnova.com.ar/v2/shipments/quote`)
usando credenciales de cuenta (autenticación básica HTTP).

### Secrets requeridos en Supabase
```bash
supabase secrets set ZIPPIN_API_KEY=tu_api_token
supabase secrets set ZIPPIN_API_SECRET=tu_api_secret
supabase secrets set ZIPPIN_ACCOUNT_ID=tu_account_id
# opcional: si se omite, Zipnova usa el origen por defecto de la cuenta
# supabase secrets set ZIPPIN_ORIGIN_ID=12345
# opcional: CP de despacho del local (metadata). Sino usa el `origen_cp`
# que envía el frontend (VITE_ZIPPIN_ORIGIN_CP).
# supabase secrets set ZIPPIN_ORIGIN_CP=4400
```
Las credenciales se generan en la cuenta Zipnova: **Configuración → Integraciones → Gestionar credenciales y webhooks**.

> Nota: la API de Zipnova maneja el origen por `origin_id` (ID del address book de la cuenta), no por
> código postal. Por eso no se usa la variable `ORIGIN_POSTAL_CODE`: se deja el origen por defecto de la
> cuenta a menos que configures `ZIPPIN_ORIGIN_ID`.

### Deploy
```bash
supabase functions deploy zippin-envio
```
`zippin-envio` se invoca desde el frontend con la anon key (verifica JWT).

### Fallback de paquete por defecto
Si un producto no declara peso/dimensiones, se asume **30 × 20 × 5 cm y 0,3 kg (300 g) por unidad**.

### Modo fallback / mock
Si la API de Zipnova falla (credenciales incompletas, `origin_id` no configurado, dirección no válida)
o no devuelve opciones seleccionables, la función **no corta el flujo de compra**: devuelve una respuesta
exitosa (`mock: true`) con estas opciones fijas de prueba:

| Opción | Costo | Demora |
| --- | --- | --- |
| Envío Estándar a Domicilio (Andreani / Correo Argentino) | $4.500 | 3 a 5 días hábiles |
| Envío Exprés a Sucursal | $3.200 | 2 a 3 días hábiles |
| Retiro en Local / Punto de Encuentro | $0 | Gratis |

El frontend trata estas opciones exactamente igual que las reales: se pueden seleccionar, se suman al
total del carrito/checkout y se envían a la preferencia de Mercado Pago.

## Cotización de envíos con Andreani PYME

La función `andreani-envio` cotiza directamente contra la API de Andreani
(`https://apis.andreani.com`) enviando el número de contrato en el campo
`contrato` del endpoint `GET /v1/tarifas`.

### Secrets requeridos en Supabase
```bash
supabase secrets set ANDREANI_USER=ikigaiclothes.contacto@gmail.com
supabase secrets set ANDREANI_PASSWORD=TU_CONTRASEÑA_ANDREANI
supabase secrets set ANDREANI_CONTRATO=46717557
# opcionales:
# supabase secrets set ANDREANI_CONTRATO_FALLBACK=otro_contrato   # se prueba si el 1º es inválido
# supabase secrets set ANDREANI_CLIENTE=codigo_de_cliente         # param `cliente` del v1/tarifas
# supabase secrets set ANDREANI_API_BASE=https://apisqa.andreani.com   # QA
```

`ANDREANI_CONTRATO` es el **DNI/CUIT registrado** (46717557). El login usa
`POST /v2/login` (con fallback al `GET /login` clásico con Basic Auth) y el token
se cachea 24 hs.

### Contrato inválido → fallback automático
Si la API responde con error de **contrato inválido** (status 4xx o mensaje que
contiene "contrato"), la función prueba automáticamente `ANDREANI_CONTRATO_FALLBACK`
(si está seteado). Mientras soporte de Andreani confirma el código exacto, ante este
error la función **no corta el flujo de compra**: devuelve opciones de referencia con
`mock: true` y el campo `error` "Contrato de Andreani pendiente de confirmación",
exactamente como las demás integraciones de envío.

### Deploy
```bash
supabase functions deploy andreani-envio
```
Recibe los mismos parámetros que `enviopack-envio`
(`{ postal_code, weight, height, width, length, bultos, valor_declarado }`, peso en kg)
y devuelve el mismo formato uniforme (`id_servicio`, `carrier.name`, `costo`,
`tiempo_estimado`, etc.), por lo que el frontend puede alternar entre una y otra
función cambiando solo el nombre del endpoint en `src/lib/enviopack.ts`.

## Cotización de envíos con OCA (activa)

La función `oca-envio` cotiza directamente contra el Web Service de OCA
(`Tarifar_Envio_Corporativo` de la plataforma e-Pak). A diferencia de Andreani y
EnvíoPack, **no requiere credenciales de usuario**: solo un CUIT registrado que se
envía en el campo `Cuit`. Funciona incluso sin contrato comercial (devuelve las
tarifas de lista).

### Secrets requeridos en Supabase
```bash
supabase secrets set OCA_CUIT=##-########-#     # CUIT registrado en OCA (con guiones)
# opcionales:
# supabase secrets set OCA_API_BASE=https://webservice.oca.com.ar/ePak_tracking/Oep_TrackEPak.asmx
# supabase secrets set OCA_ORIGEN_CP=3360        # CP de despacho (default 3360, Oberá)
# supabase secrets set OCA_OPERATIVAS=64665,62342,94584,78254   # operativas separadas por coma
```

Si `OCA_CUIT` no está seteado, la función usa el **CUIT de prueba que publica OCA**
(`30-53625919-4`), que devuelve tarifas nominales. Para tarifas reales configurá el
CUIT del local (o el de la cuenta e-Pak).

Operativas por defecto (de la documentación de OCA):

| Operativa | Modalidad | Nombre en la tienda |
| --- | --- | --- |
| `64665` | Puerta a Puerta | Estándar a Domicilio |
| `62342` | Puerta a Sucursal | Estándar a Sucursal |
| `94584` | Sucursal a Puerta | A Domicilio desde Sucursal |
| `78254` | Sucursal a Sucursal | A Sucursal desde Sucursal |

Podés desactivar alguna sacándola de `OCA_OPERATIVAS` (ej. solo
`64665,94584` para cotizar únicamente entrega a domicilio).

### Deploy
```bash
supabase functions deploy oca-envio
```
Recibe los mismos parámetros que las demás funciones de envío
(`{ postal_code, weight, height, width, length, bultos, valor_declarado }`, peso en kg,
`origen_cp` opcional) y devuelve el mismo formato uniforme, por lo que el frontend
solo apunta a `oca-envio` en `src/lib/enviopack.ts` (`ENDPOINT_ENVIO`).

### Fallback / mock
Al igual que las demás integraciones, si OCA no responde o no devuelve opciones la
función **no corta el flujo de compra**: responde con opciones de referencia
(`mock: true`) — Estándar a Domicilio $4.500, Exprés a Sucursal $3.200 y Retiro en
Local $0.

## Migración de base de datos
Aplicá en el SQL Editor de Supabase:
- `supabase/migrations/004_mercadopago.sql` — agrega a `ordenes`: `mp_preference_id`, `mp_payment_id`, `mp_pago_detalle` y `updated_at`.
- `supabase/migrations/005_webhook_stock.sql` — agrega `stock_descontado` y la función `descontar_stock(p_orden_id)` (idempotente: descontar el stock una única vez por pedido y nunca negativo).
- `supabase/migrations/008_zippin_envio.sql` — agrega `ordenes.envio_detalle` (jsonb) para guardar el método de envío seleccionado (carrier, servicio, costo).
- `supabase/migrations/019_security_fixes.sql` — cierra la escalada de privilegios sobre `perfiles.es_admin`, revoca el EXECUTE de `descontar_stock()` al navegador y restringe el INSERT público de pedidos. **Requiere que `018_admin_rls.sql` esté aplicada antes.**

### `crear-orden`
Al checkout manda el carrito a esta función y **no** inserta la orden con PostgREST. Antes lo hacía, y como `monto_total` se calculaba en el navegador, era posible mandar `monto_total: 1` y comprar cualquier prenda por transferencia.

Como `019_security_fixes.sql` deja el INSERT público de `ordenes` bloqueado, esta función es la única forma de crear un pedido: usa `service_role`.

```bash
curl -X POST "$SUPABASE_URL/functions/v1/crear-orden" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{
    "cliente_nombre": "Ada Lovelace",
    "cliente_email": "ada@example.com",
    "cliente_telefono": "3512345678",
    "cliente_dni": "30111222",
    "direccion": "Av. Siempreviva 742",
    "codigo_postal": "5000",
    "metodo_pago": "transferencia",
    "costo_envio": 8000,
    "cupon_codigo": null,
    "envio": { "metodo": "envio", "carrier": "Andreani", "costo": 8000 },
    "items": [{ "producto_id": "<uuid>", "talle": "M", "cantidad": 1, "precio_unitario": 45000 }]
  }'
```

Notas:
- `precio_unitario` y `monto_total` del body se ignoran. Los precios salen de `productos.precio` con `discount_percent` aplicado, igual que el front.
- El descuento por transferencia sale de `config_tienda.descuento_transferencia` (guardado como porcentaje: `'20'` = 20%).
- El envío gratis se recalcula contra `umbral_envio_gratis` **sobre el subtotal ya descontado**, que es lo que hace el front. Si aplica, `costo_envio` queda en 0 aunque el body mande la cotización.
- El costo de envío cotizado se acota a un rango razonable (`COTIZACION_MIN`/`MAX`) porque viene del navegador y no hay tabla de cotizaciones contra la cual validarlo. Para eliminar esa confianza habría que cotizar server-side con el CP del cliente.
- Valida contra stock real: producto activo, talle existente y cantidad disponible.
- Devuelve el desglose (`monto_total`, `subtotal`, `descuento_transferencia`, `descuento_cupon`, `costo_envio`, `envio_gratis`) para que el front muestre lo que realmente se cobra.

Deploy:
```bash
supabase functions deploy crear-orden
```

### `admin-estado-orden`
Cambia el estado de un pedido desde el panel (`PedidosAdmin` → "Actualizar estado").

```bash
curl -X POST "$SUPABASE_URL/functions/v1/admin-estado-orden" \
  -H "Authorization: Bearer <JWT del admin>" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"orden_id":"<uuid>","estado":"pagado"}'
```

Cuando `estado` es `pagado` también descuenta el stock y consume un uso del cupón, con service role. Es el camino que permite revocar el EXECUTE de `descontar_stock()` y `usar_cupon()` a `anon`/`authenticated` (ver `016_cupones.sql:78-80` y `019_security_fixes.sql`).

## Notas de seguridad
- El webhook **nunca confía en el body**: consulta `GET /v1/payments/{id}` con el Access Token y valida el monto contra `ordenes.monto_total` antes de actualizar.
- `create-preference` valida el total de los ítems contra el monto guardado en la base antes de crear la preferencia. **Ojo:** hoy solo valida consistencia interna, todavía no relee `productos.precio` (ver informe de auditoría).
- `admin-estado-orden` valida el JWT con `auth.getUser()` y comprueba `perfiles.es_admin` en el servidor: el gate del frontend (`AdminLayout`) es solo UX y se puede saltear desde DevTools.
- La URL de notificación se genera desde `SUPABASE_URL`
  (`https://TU-PROYECTO.supabase.co/functions/v1/mercadopago-webhook`) y la pasa el frontend en cada creación de preferencia.
- Para producción, considerá verificar la firma `x-signature` del webhook. La re-consulta a la API de MP ya mitiga la mayor parte del riesgo.
- `supabase/functions/.env` tiene credenciales reales de los couriers (EnvíoPack, Andreani, OCA). No está en Git, pero conviene moverlas a `supabase secrets set` para que no queden en el disco.