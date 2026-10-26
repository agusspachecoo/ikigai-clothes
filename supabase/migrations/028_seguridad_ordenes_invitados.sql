-- ============================================================
-- 028_seguridad_ordenes_invitados.sql
--
-- Cierra el checkout invitado sin abrir la lectura de datos personales:
--
--   1. `ordenes` y `orden_items` dejan de aceptar INSERT directo desde
--      anon/authenticated. La única vía es `crear-orden` (service_role).
--   2. La lectura de pedidos queda atada a `cliente_id = auth.uid()`.
--      Se elimina el fallback por email de 019.
--   3. El invitado accede a su pedido con un token aleatorio de un solo
--      uso (se guarda SOLO el hash SHA-256) y un magic link de Supabase Auth.
--   4. Storage deja de aceptar comprobantes anónimos: los sube la Edge
--      Function `preparar-comprobante` con una signed upload URL.
--   5. `productos_mas_vendidos` reemplaza la lectura pública de `orden_items`.
--
-- Requiere aplicar 019, 022, 023 y 027 antes.
-- NO aplicar en producción sin backup y sin desplegar primero las functions
-- de la misma tanda: el checkout viejo deja de poder insertar órdenes.
-- ============================================================

DO $$
DECLARE
  faltan text[] := '{}';
BEGIN
  IF to_regclass('public.ordenes') IS NULL THEN
    faltan := faltan || 'public.ordenes (falta 001_initial.sql)';
  END IF;
  IF to_regclass('public.orden_items') IS NULL THEN
    faltan := faltan || 'public.orden_items (falta 001_initial.sql)';
  END IF;
  IF to_regclass('public.productos') IS NULL THEN
    faltan := faltan || 'public.productos (falta 001_initial.sql)';
  END IF;
  IF to_regprocedure('public.es_admin()') IS NULL THEN
    faltan := faltan || 'public.es_admin() (falta 012_auth.sql)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'ordenes' AND column_name = 'cliente_id'
  ) THEN
    faltan := faltan || 'ordenes.cliente_id (falta 019_security_fixes.sql)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'ordenes' AND column_name = 'descuento_outfit'
  ) THEN
    faltan := faltan || 'ordenes.descuento_outfit (falta 023)';
  END IF;

  IF cardinality(faltan) > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = '028 no se puede aplicar: faltan migraciones previas.',
      DETAIL  = array_to_string(faltan, E'\n  - '),
      HINT    = 'Aplicá 019, 022, 023 y 027 en orden antes de correr 028.';
  END IF;

  RAISE NOTICE 'PRECHECK OK. Continuando con 028.';
END;
$$;


-- ============================================================
-- 1. Token de acceso para invitados
-- ============================================================
-- El token se genera en `crear-orden` (32 bytes aleatorios). En la base
-- queda únicamente SHA-256 en hexadecimal. La comparación la hace la Edge
-- Function con service_role, nunca PostgREST desde el navegador.
ALTER TABLE public.ordenes
  ADD COLUMN IF NOT EXISTS guest_token_hash text;

ALTER TABLE public.ordenes
  ADD COLUMN IF NOT EXISTS guest_token_expira_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'ordenes_guest_token_hash_formato'
       AND conrelid = 'public.ordenes'::regclass
  ) THEN
    ALTER TABLE public.ordenes
      ADD CONSTRAINT ordenes_guest_token_hash_formato
      CHECK (guest_token_hash IS NULL OR guest_token_hash ~ '^[a-f0-9]{64}$');
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ordenes_guest_token_hash
  ON public.ordenes (guest_token_hash)
  WHERE guest_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ordenes_guest_token_expira
  ON public.ordenes (guest_token_expira_at)
  WHERE guest_token_hash IS NOT NULL;

COMMENT ON COLUMN public.ordenes.guest_token_hash IS
  'SHA-256 hex del token de acceso invitado. El token en claro nunca se guarda.';
COMMENT ON COLUMN public.ordenes.guest_token_expira_at IS
  'Vencimiento del acceso invitado. Pasado ese momento solo se accede con sesión reclamada.';


-- ============================================================
-- 2. Escritura de pedidos: solo Edge Functions (service_role)
-- ============================================================
-- Las policies de 019/023 permitían INSERT público aunque los montos se
-- recalcularan en la Edge Function. Cualquiera podía saltear `crear-orden`
-- e insertar una orden con `estado_pago` manipulado (la policy lo limitaba,
-- pero seguía siendo una superficie innecesaria) o crear basura.
DROP POLICY IF EXISTS "Cualquiera puede crear orden" ON public.ordenes;
DROP POLICY IF EXISTS "Cualquiera puede crear items de orden" ON public.orden_items;

REVOKE INSERT, UPDATE, DELETE ON public.ordenes FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.orden_items FROM anon, authenticated;

-- El admin actualiza por `admin-estado-orden` con service_role. Se elimina
-- también la policy de UPDATE directa para que el navegador no pueda tocar
-- estados ni comprobantes aunque en el futuro alguien re-otorgue el GRANT.
DROP POLICY IF EXISTS "Admin actualiza órdenes" ON public.ordenes;


-- ============================================================
-- 3. Lectura de pedidos: dueño de la sesión o admin
-- ============================================================
DROP POLICY IF EXISTS "El usuario lee sus propias órdenes" ON public.ordenes;
CREATE POLICY "El usuario lee sus propias órdenes" ON public.ordenes
  FOR SELECT TO authenticated
  USING (
    cliente_id = auth.uid()
    OR public.es_admin()
  );

DROP POLICY IF EXISTS "El usuario lee los items de sus órdenes" ON public.orden_items;
CREATE POLICY "El usuario lee los items de sus órdenes" ON public.orden_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.ordenes o
       WHERE o.id = orden_items.orden_id
         AND (o.cliente_id = auth.uid() OR public.es_admin())
    )
  );


-- ============================================================
-- 4. Comprobantes: sin subida anónima directa
-- ============================================================
-- La subida pasa por `preparar-comprobante`, que valida token/JWT y
-- devuelve una signed upload URL para un path generado en el servidor.
DROP POLICY IF EXISTS "Invitado sube su comprobante de transferencia" ON storage.objects;


-- ============================================================
-- 5. Más vendidos sin exponer orden_items
-- ============================================================
CREATE OR REPLACE FUNCTION public.productos_mas_vendidos(p_limit integer DEFAULT 8)
RETURNS TABLE (producto_id uuid, total_vendido bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oi.producto_id, SUM(oi.cantidad)::bigint AS total_vendido
    FROM public.orden_items oi
    JOIN public.ordenes o ON o.id = oi.orden_id
   WHERE oi.producto_id IS NOT NULL
     AND o.estado IN ('pagado', 'enviado', 'entregado')
   GROUP BY oi.producto_id
   ORDER BY total_vendido DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 8), 1), 50);
$$;

REVOKE ALL ON FUNCTION public.productos_mas_vendidos(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.productos_mas_vendidos(integer)
  TO anon, authenticated, service_role;


-- ============================================================
-- VERIFICACIÓN (todo debe dar 0 filas salvo las consultas informativas)
-- ============================================================
-- Policies de escritura pública que ya no deben existir:
--   select policyname, cmd, roles from pg_policies
--    where schemaname = 'public'
--      and tablename in ('ordenes', 'orden_items')
--      and cmd in ('INSERT', 'UPDATE', 'DELETE');
--
-- La lectura no debe mencionar cliente_email:
--   select policyname, pg_get_expr(qual, polrelid)
--     from pg_policy
--    where polrelid in ('public.ordenes'::regclass, 'public.orden_items'::regclass);
--
-- No debe quedar la policy anónima de comprobantes:
--   select policyname, cmd, roles from pg_policies
--    where schemaname = 'storage' and tablename = 'objects'
--      and policyname = 'Invitado sube su comprobante de transferencia';
--
-- Columnas del token:
--   select column_name, data_type from information_schema.columns
--    where table_schema = 'public' and table_name = 'ordenes'
--      and column_name like 'guest_token%';
--
-- RPC de más vendidos:
--   select has_function_privilege('anon', 'public.productos_mas_vendidos(integer)', 'EXECUTE');


-- ============================================================
-- REVERTIR (solo desarrollo; reabre escritura pública)
-- ============================================================
-- drop function if exists public.productos_mas_vendidos(integer);
-- create policy "Invitado sube su comprobante de transferencia" on storage.objects
--   for insert to anon, authenticated
--   with check (bucket_id = 'comprobantes');
-- drop policy if exists "El usuario lee sus propias órdenes" on public.ordenes;
-- create policy "El usuario lee sus propias órdenes" on public.ordenes
--   for select to authenticated
--   using (cliente_id = auth.uid() or (cliente_id is null and cliente_email = auth.jwt() ->> 'email') or public.es_admin());
-- grant insert, update, delete on public.ordenes to anon, authenticated;
-- grant insert, update, delete on public.orden_items to anon, authenticated;
-- alter table public.ordenes drop column if exists guest_token_hash;
-- alter table public.ordenes drop column if exists guest_token_expira_at;
