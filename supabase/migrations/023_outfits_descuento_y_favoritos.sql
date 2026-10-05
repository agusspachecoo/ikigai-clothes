-- ============================================================
-- 023_outfits_descuento_y_favoritos.sql
--
-- Bloque 5:
--   1. Descuento por outfit completo (5% sobre las prendas que
--      completan un outfit activo). El importe se calcula en
--      `crear-orden` (service_role) y se persiste acá para auditoría.
--      `create-preference` lo recalcula contra `outfit_items` y valida
--      que coincida antes de cobrar.
--   2. Favoritos / wishlist por usuario. Es la primera tabla del
--      catálogo que exige sesión real: RLS por `auth.uid()`.
--
-- Aplicar con:
--   npx supabase db query --linked -f supabase/migrations/023_outfits_descuento_y_favoritos.sql
-- ============================================================


-- ============================================================
-- PRECHECK
-- ============================================================
DO $$
DECLARE
  faltan text[] := '{}';
BEGIN
  IF to_regclass('public.ordenes') IS NULL THEN
    faltan := faltan || 'public.ordenes (falta 001_initial.sql)';
  END IF;
  IF to_regclass('public.outfits') IS NULL OR to_regclass('public.outfit_items') IS NULL THEN
    faltan := faltan || 'public.outfits / outfit_items (falta 001_initial.sql)';
  END IF;
  IF to_regclass('public.productos') IS NULL THEN
    faltan := faltan || 'public.productos (falta 001_initial.sql)';
  END IF;

  IF cardinality(faltan) > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = '023 no se puede aplicar: falta migración previa.',
      DETAIL  = array_to_string(faltan, E'\n  - '),
      HINT    = 'Aplicá 001 y 019 en orden antes de correr 023.';
  END IF;

  RAISE NOTICE 'PRECHECK OK. Continuando con 023.';
END;
$$;


-- ============================================================
-- 1. ordenes.descuento_outfit
-- ============================================================
-- Mismo criterio que descuento_cupon (016): el importe que efectivamente
-- se descontó, no el porcentaje. Así el total se puede reconstruir con:
--   monto_total = subtotal - descuento_outfit - descuento_cupon
--                              - descuento_transferencia + costo_envio
ALTER TABLE public.ordenes
  ADD COLUMN IF NOT EXISTS descuento_outfit numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.ordenes.descuento_outfit IS
  'Descuento por outfit completo (5% de las prendas del combo). Calculado en crear-orden.';


-- La política de INSERT de 019 no mencionaba este campo. Se recrea con el
-- chequeo `descuento_outfit >= 0` para que el valor no pueda ser negativo
-- si en el futuro vuelve a insertar el navegador (hoy inserta la Edge Function
-- con service_role, que saltea RLS, pero la política se mantiene coherente).
DROP POLICY IF EXISTS "Cualquiera puede crear orden" ON public.ordenes;

CREATE POLICY "Cualquiera puede crear orden" ON public.ordenes
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    estado_pago = 'pendiente'
    AND estado = 'pendiente'
    AND stock_descontado = false
    AND cupon_consumido IS NULL
    AND mp_preference_id IS NULL
    AND mp_payment_id IS NULL
    AND mp_pago_detalle IS NULL
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
    AND descuento_outfit >= 0
  );


-- ============================================================
-- 2. favoritos (wishlist)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.favoritos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, producto_id)
);

-- La consulta natural es "dame los favoritos de este usuario".
CREATE INDEX IF NOT EXISTS idx_favoritos_usuario ON public.favoritos (usuario_id);

ALTER TABLE public.favoritos ENABLE ROW LEVEL SECURITY;

-- A diferencia del resto del admin (abierto por el frontend, ver NOTA DE
-- SEGURIDAD de 012), acá SÍ se ata a `auth.uid()`: un favorito es dato
-- personal y no hay motivo para que sea legible sin sesión.
DROP POLICY IF EXISTS "favoritos propios - leer" ON public.favoritos;
CREATE POLICY "favoritos propios - leer" ON public.favoritos
  FOR SELECT TO authenticated
  USING (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "favoritos propios - insertar" ON public.favoritos;
CREATE POLICY "favoritos propios - insertar" ON public.favoritos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "favoritos propios - borrar" ON public.favoritos;
CREATE POLICY "favoritos propios - borrar" ON public.favoritos
  FOR DELETE TO authenticated
  USING (auth.uid() = usuario_id);


-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- Columna nueva:
--   select column_name, data_type from information_schema.columns
--    where table_schema='public' and table_name='ordenes' and column_name='descuento_outfit';
--
-- Política recreada con descuento_outfit:
--   select pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
--     from pg_policy where polname = 'Cualquiera puede crear orden';
--
-- Favoritos + RLS:
--   select tablename, rowsecurity from pg_tables
--    where schemaname='public' and tablename='favoritos';
--   select policyname, cmd, roles from pg_policies
--    where schemaname='public' and tablename='favoritos';


-- ============================================================
-- REVERTIR
-- ============================================================
-- drop policy if exists "favoritos propios - leer" on public.favoritos;
-- drop policy if exists "favoritos propios - insertar" on public.favoritos;
-- drop policy if exists "favoritos propios - borrar" on public.favoritos;
-- drop table if exists public.favoritos;
-- alter table public.ordenes drop column if exists descuento_outfit;
-- (y volver a crear la política de 019 sin el chequeo de descuento_outfit)
-- ============================================================
