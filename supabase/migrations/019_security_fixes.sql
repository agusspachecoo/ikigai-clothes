-- ============================================================
-- 019_security_fixes.sql
--
-- Cierra tres holes de privilege escalation y DoS que 018_no cubrió:
--
--   1. perfiles.es_admin era auto-asignable. Las policies de 018 delegan
--      todas en public.es_admin(), que lee esa columna, así que un registro
--      gratuito se auto-promovía a admin y heredaba TODAS las policies
--      "Admin gestiona ...".
--   2. descontar_stock() era SECURITY DEFINER sin REVOKE: anon podía
--      invocarla por PostgREST y vaciar el stock de cualquier SKU.
--   3. El INSERT público de ordenes/orden_items era WITH CHECK (true):
--      el cliente escribía estado_pago, estado y stock_descontado a su
--      antojo (comprar sin pagar, o comprar y conservar el inventario).
--
-- IMPORTANTE - prerequisites antes de aplicar:
--   - 018_admin_rls.sql debe estar aplicada (esta migración asume que las
--     policies "Admin gestiona ..." ya existen). Verificar con el query
--     de la sección VERIFICACIÓN.
--   - Los únicos que siguen invocando descontar_stock() con service_role son
--     el webhook de Mercado Pago y la Edge Function admin-estado-orden
--     (confirmación manual de transferencias). El panel ya no la llama
--     desde el navegador.
--
-- Aplicar con:  npx supabase db query --linked -f supabase/migrations/019_security_fixes.sql
-- O pegar el archivo entero en el SQL Editor de Supabase (Dashboard).
-- ============================================================


-- ============================================================
-- PRECHECK: verifica que las migraciones previas estén aplicadas
-- ============================================================
-- Si falta 012_auth.sql (y con ella la tabla perfiles), Postgres aborta con
--   ERROR: 42P01: relation "public.perfiles" does not exist
-- que no dice qué migración falta. Este bloque corta antes, con un mensaje
-- que sí dice qué aplicar y en qué orden.
--
-- Ojo con el nombre: la tabla es public.perfiles (en español, una sola 'e'
-- después de la 'p'). El nombre equivalente en inglés NO existe en este
-- esquema y produce 42P01; ya se corrigió una mezcla de ambos nombres en
-- este archivo. Si se reintroduce la forma inglesa, la migración falla.
--
-- Es un DO block: si algo falta, hace RAISE y ABORTA toda la
-- transacción, así que no queda la migración aplicada a medias.
DO $$
DECLARE
  faltan text[] := '{}';
BEGIN
  -- 012_auth.sql: perfiles + es_admin()
  IF to_regclass('public.perfiles') IS NULL THEN
    faltan := faltan || 'public.perfiles (falta 012_auth.sql)';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'perfiles'
       AND column_name = 'es_admin'
  ) THEN
    faltan := faltan || 'perfiles.es_admin (falta 012_auth.sql)';
  END IF;

  IF to_regprocedure('public.es_admin()') IS NULL THEN
    faltan := faltan || 'public.es_admin() (falta 012_auth.sql)';
  END IF;

  -- 018_admin_rls.sql: las policies "Admin gestiona ..." que 019 conserva.
  -- Si 018 no corrió, el panel sigue abierto con USING (true).
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'productos'
       AND policyname = 'Admin gestiona productos'
  ) THEN
    faltan := faltan || 'policy "Admin gestiona productos" (falta 018_admin_rls.sql)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'ordenes'
       AND policyname = 'Admin actualiza órdenes'
  ) THEN
    faltan := faltan || 'policy "Admin actualiza órdenes" (falta 018_admin_rls.sql)';
  END IF;

  -- Tablas que 019 modifica: tienen que existir (001_initial.sql).
  IF to_regclass('public.ordenes') IS NULL THEN
    faltan := faltan || 'public.ordenes (falta 001_initial.sql)';
  END IF;

  IF to_regclass('public.orden_items') IS NULL THEN
    faltan := faltan || 'public.orden_items (falta 001_initial.sql)';
  END IF;

  -- 005_webhook_stock.sql y 016_cupones.sql
  IF to_regprocedure('public.descontar_stock(uuid)') IS NULL THEN
    faltan := faltan || 'public.descontar_stock() (falta 005_webhook_stock.sql)';
  END IF;

  -- Columnas de ordenes que las policies de la sección 3 leen.
  IF to_regclass('public.ordenes') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'ordenes'
         AND column_name = 'stock_descontado'
    ) THEN
      faltan := faltan || 'ordenes.stock_descontado (falta 005_webhook_stock.sql)';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'ordenes'
         AND column_name = 'cupon_consumido'
    ) THEN
      faltan := faltan || 'ordenes.cupon_consumido (falta 016_cupones.sql)';
    END IF;
  END IF;

  IF cardinality(faltan) > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = '019 no se puede aplicar: faltan migraciones previas.',
      DETAIL  = array_to_string(faltan, E'\n  - '),
      HINT    = 'Aplicá 012_auth.sql, 018_admin_rls.sql y las demás migraciones '
                || 'en orden (001 -> 018) y volvé a correr 019. '
                || 'Verificá el proyecto con: select current_database();';
  END IF;

  RAISE NOTICE 'PRECHECK OK: 012, 016 y 018 detectadas. Continuando con 019.';
END;
$$;


-- ============================================================
-- SECCIÓN 1: es_admin deja de ser auto-asignable
-- ============================================================

-- RLS es por FILA, nunca por columna: la policy
--   "El usuario edita su propio perfil" FOR UPDATE USING (auth.uid() = id)
-- no alcanza, porque su WITH CHECK implícito solo fija la columna id.
-- Un PATCH /rest/v1/perfiles?id=eq.<mi_uuid> {"es_admin": true} pasaba.
-- REVOKE a nivel de columna es lo que realmente cierra el hueco.
REVOKE UPDATE (es_admin) ON public.perfiles FROM anon, authenticated;

-- Defensa en profundidad: si alguien más adelante agrega el privilegio
-- de vuelta, el trigger sigue frenando el cambio de rol desde el cliente.
CREATE OR REPLACE FUNCTION public.proteger_es_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  rol_actual text;
BEGIN
  IF OLD.es_admin IS DISTINCT FROM NEW.es_admin THEN
    rol_actual := current_setting('role', true);

    -- Solo se bloquea cuando la escritura llega por los roles que el
    -- navegador puede obtener: la anon key y la sesión de un usuario.
    -- service_role (Edge Functions), postgres y supabase_admin (Dashboard /
    -- SQL Editor) siguen pudiendo promover cuentas a admin.
    IF rol_actual IN ('anon', 'authenticated') THEN
      RAISE EXCEPTION
        'es_admin no puede modificarse desde el cliente (id=%)', OLD.id
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_es_admin ON public.perfiles;
CREATE TRIGGER trg_proteger_es_admin
  BEFORE UPDATE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION public.proteger_es_admin();

-- La policy de INSERT de 013_perfiles_campos.sql deja otra puerta a
-- es_admin = true. Es innecesaria: el trigger on_auth_user_created
-- (012_auth.sql:39) ya crea la fila del perfil al registrarse.
DROP POLICY IF EXISTS "El usuario crea su propio perfil" ON public.perfiles;

-- ------------------------------------------------------------
-- Reversión del promote masivo de 018_admin_rls.sql:26
-- ------------------------------------------------------------
-- Ese update no tenía filtro: promovió a TODOS los perfiles existentes.
-- Revertir a false y después promover solo las cuentas reales.
-- REVISAR PRIMERO la lista (query en VERIFICACIÓN) y ajustar el IN.
UPDATE public.perfiles SET es_admin = false
 WHERE es_admin = true
   AND email NOT IN ('ikigaiclothes.contacto@gmail.com');

-- Promover de nuevo, solo lo necesario:
--   update public.perfiles set es_admin = true where email = 'TU-ADMIN@dominio.com';
-- (El trigger lo deja pasar: el SQL Editor y el service key corren como
--  postgres / service_role, no como anon ni authenticated.)


-- ============================================================
-- SECCIÓN 2: descontar_stock() deja de ser ejecutable por el navegador
-- ============================================================

-- Mismo patrón que 016_cupones.sql:78-80 aplicó a usar_cupon.
-- service_role ignora RLS, así que el webhook de Mercado Pago
-- (mercadopago-webhook/index.ts:104) sigue funcionando sin cambios.
REVOKE ALL ON FUNCTION public.descontar_stock(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.descontar_stock(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.descontar_stock(uuid) TO service_role;

-- Precondición: solo se descuenta de órdenes ya pagadas. Suma una barrera
-- más para el caso de que el privilegio se reabra por error.
CREATE OR REPLACE FUNCTION public.descontar_stock(p_orden_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
BEGIN
  UPDATE ordenes
     SET stock_descontado = true
   WHERE id = p_orden_id
     AND stock_descontado = false
     AND estado_pago = 'pagado';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  FOR item IN
    SELECT producto_id, talle, cantidad
      FROM orden_items
     WHERE orden_id = p_orden_id
  LOOP
    UPDATE variaciones_stock
       SET stock_disponible = GREATEST(stock_disponible - item.cantidad, 0)
     WHERE producto_id = item.producto_id
       AND talle = item.talle;
  END LOOP;
END;
$$;

-- El GRANT explícito sobrevive al CREATE OR REPLACE, pero se repite
-- para que el archivo sea idempotente.
REVOKE ALL ON FUNCTION public.descontar_stock(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.descontar_stock(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.descontar_stock(uuid) TO service_role;


-- ============================================================
-- SECCIÓN 3: el INSERT de pedidos deja de aceptar campos terminales
-- ============================================================

-- Guest checkout sigue siendo público, pero el cliente solo puede fijar
-- los datos del pedido. estado_pago / estado / stock_descontado / mp_*
-- los escriben el webhook de Mercado Pago o el admin.
--
-- Impacto que cierra:
--   - estado_pago='pagado' / estado='pagado' al insertar  →mercancía
--     enviada sin cobrar (PedidosAdmin los muestra como "Pagado").
--   - stock_descontado=true al insertar → el webhook real hace early
--     return (005:26-28) y el stock nunca se descuenta.

DROP POLICY IF EXISTS "Cualquiera puede crear orden" ON public.ordenes;

CREATE POLICY "Cualquiera puede crear orden" ON public.ordenes
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    -- Campos de estado: siempre en su valor inicial.
    estado_pago = 'pendiente'
    AND estado = 'pendiente'
    AND stock_descontado = false
    AND cupon_consumido IS NULL
    -- Datos de Mercado Pago: los escribe la Edge Function / el webhook.
    AND mp_preference_id IS NULL
    AND mp_payment_id IS NULL
    AND mp_pago_detalle IS NULL
    -- Datos obligatorios, no vacíos ni negativos.
    AND metodo_pago IN ('mercadopago', 'transferencia')
    AND cliente_nombre    <> ''
    AND cliente_email     <> ''
    AND cliente_telefono  <> ''
    AND cliente_dni       <> ''
    AND direccion         <> ''
    AND codigo_postal     <> ''
    AND monto_total > 0
    AND costo_envio >= 0
    AND descuento_cupon >= 0
  );

-- Los precios unitarios siguen viniendo del cliente: eso lo corrige la
-- Edge Function create-preference releyendo productos.precio (ver el
-- informe). Acá solo se acotan los valores absurdos que permitirían
-- inflar o vaciar el stock vía la cantidad.
DROP POLICY IF EXISTS "Cualquiera puede crear items de orden" ON public.orden_items;

CREATE POLICY "Cualquiera puede crear items de orden" ON public.orden_items
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    cantidad > 0
    AND cantidad <= 20
    AND precio_unitario > 0
  );


-- ============================================================
-- SECCIÓN 4: "mis pedidos" pasa a anclarse en auth.uid()
-- ============================================================
-- 012_auth.sql:57-61 comparaba por cliente_email, una columna que el
-- cliente elige al crear el pedido y que no está verificada contra
-- auth.users. Cualquier cuenta registrada con ese email heredaba todos
-- los pedidos hechos con él. cliente_id lo setea el trigger de abajo.

ALTER TABLE public.ordenes
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ordenes_cliente_id ON public.ordenes(cliente_id);

-- Backfill: las órdenes whose email coincide con una cuenta existente
-- quedan enlazadas. Solo informational; el cliente igual ve las suyas
-- por el fallback de la policy.
UPDATE public.ordenes o
   SET cliente_id = u.id
  FROM auth.users u
 WHERE o.cliente_id IS NULL
   AND lower(u.email) = lower(o.cliente_email);

-- El cliente no elige su cliente_id: se fuerza a ser el usuario de la sesión.
CREATE OR REPLACE FUNCTION public.asignar_cliente_id_orden()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Si el insert viene de un usuario autenticado, su id gana.
  -- Si viene de anon (guest sin sesión), queda NULL y la orden se
  -- referencia por email como antes.
  IF auth.uid() IS NOT NULL THEN
    NEW.cliente_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_asignar_cliente_id_orden ON public.ordenes;
CREATE TRIGGER trg_asignar_cliente_id_orden
  BEFORE INSERT ON public.ordenes
  FOR EACH ROW EXECUTE FUNCTION public.asignar_cliente_id_orden();

DROP POLICY IF EXISTS "El usuario lee sus propias órdenes" ON public.ordenes;

CREATE POLICY "El usuario lee sus propias órdenes" ON public.ordenes
  FOR SELECT TO authenticated
  USING (
    cliente_id = auth.uid()
    -- Fallback para pedidos hechos antes del backfill, mientras el
    -- cliente_id siga sin linkear.
    OR (
      cliente_id IS NULL
      AND cliente_email = auth.jwt() ->> 'email'
    )
    OR public.es_admin()
  );

DROP POLICY IF EXISTS "El usuario lee los items de sus órdenes" ON public.orden_items;

CREATE POLICY "El usuario lee los items de sus órdenes" ON public.orden_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ordenes o
       WHERE o.id = orden_items.orden_id
         AND (
           o.cliente_id = auth.uid()
           OR (o.cliente_id IS NULL AND o.cliente_email = auth.jwt() ->> 'email')
           OR public.es_admin()
         )
    )
  );


-- ============================================================
-- VERIFICACIÓN (correr después de aplicar; todo debería dar 0 filas)
-- ============================================================
-- Policies de admin abiertas heredadas de 002/007/009/017 (USING true):
--   select policyname, cmd, qual from pg_policies
--    where schemaname='public' and policyname like 'Admin panel%';
--
-- Tablas con policies pero RLS apagado:
--   select c.relname from pg_class c
--     join pg_namespace n on n.oid=c.relnamespace
--    where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;
--
-- descontar_stock ejecutable por el navegador (ambas deben dar false):
--   select has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_exec,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec
--     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--    where n.nspname='public' and p.proname='descontar_stock';
--
-- Quién quedó como admin (revisar que sea solo lo esperado):
--   select email, es_admin from public.perfiles where es_admin;
--
-- Confirmar que cliente_id quedó poblado:
--   select count(*) total, count(cliente_id) con_usuario from public.ordenes;

-- ============================================================
-- REVERTIR (deja la escalada de privilegios abierta, no usar en producción)
-- ============================================================
-- grant update (es_admin) on public.perfiles to authenticated;
-- drop trigger if exists trg_proteger_es_admin on public.perfiles;
-- drop policy if exists "El usuario crea su propio perfil" on public.perfiles;
-- grant execute on function public.descontar_stock(uuid) to anon, authenticated;
-- drop policy if exists "Cualquiera puede crear orden" on public.ordenes;
-- create policy "Cualquiera puede crear orden" on public.ordenes
--   for insert with check (true);
-- drop policy if exists "Cualquiera puede crear items de orden" on public.orden_items;
-- create policy "Cualquiera puede crear items de orden" on public.orden_items
--   for insert with check (true);
-- ============================================================