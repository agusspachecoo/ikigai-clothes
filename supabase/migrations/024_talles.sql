-- ============================================================
-- 024_talles.sql
--
-- Lista maestra de talles editable desde el panel.
--
-- Hasta ahora los talles sugeridos en el formulario de productos
-- estaban quemados en el código (TALLES_SUGERIDOS) y el orden de
-- los talles de la tienda dependía de un arreglo fijo en
-- `src/lib/talles.ts`. Esta tabla reemplaza ambos: el admin puede
-- agregar, renombrar, ordenar y desactivar talles, y la tienda usa
-- ese orden para mostrar las curvas de talle.
--
-- El stock sigue viviendo por producto en `variaciones_stock`, que
-- acepta cualquier texto: la lista maestra es solo una guía de
-- sugerencias y de orden, nunca una restricción.
--
-- Aplicar con:
--   npx supabase db query --linked -f supabase/migrations/024_talles.sql
-- ============================================================


-- ============================================================
-- PRECHECK
-- ============================================================
DO $$
DECLARE
  faltan text[] := '{}';
BEGIN
  IF to_regprocedure('public.es_admin()') IS NULL THEN
    faltan := faltan || 'public.es_admin() (falta 012_auth.sql)';
  END IF;

  IF cardinality(faltan) > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = '024 no se puede aplicar: falta migración previa.',
      DETAIL  = array_to_string(faltan, E'\n  - '),
      HINT    = 'Aplicá 012_auth.sql (y 018_admin_rls.sql) antes de correr 024.';
  END IF;

  RAISE NOTICE 'PRECHECK OK. Continuando con 024.';
END;
$$;


-- ============================================================
-- 1. Tabla talles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.talles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.talles IS
  'Lista maestra de talles editable desde el panel. Sugerencia de talles y orden de la curva en la tienda.';


-- ============================================================
-- 2. Seed inicial (idempotente)
-- ============================================================
-- El orden deja un hueco entre letras y numéricos para poder
-- insertar nuevos talles en el medio sin tener que renumerar todo.
INSERT INTO public.talles (nombre, orden) VALUES
  ('XS',   1),
  ('S',    2),
  ('M',    3),
  ('L',    4),
  ('XL',   5),
  ('XXL',  6),
  ('XXXL', 7),
  ('Único', 8),
  ('36',   20),
  ('38',   21),
  ('40',   22),
  ('42',   23),
  ('44',   24),
  ('46',   25),
  ('48',   26)
ON CONFLICT (nombre) DO NOTHING;


-- ============================================================
-- 3. RLS
-- ============================================================
ALTER TABLE public.talles ENABLE ROW LEVEL SECURITY;

-- La tienda solo necesita leer los talles activos para ordenar la curva.
DROP POLICY IF EXISTS "Talles visibles públicamente" ON public.talles;
CREATE POLICY "Talles visibles públicamente" ON public.talles
  FOR SELECT TO public
  USING (activo);

-- El admin gestiona todo (incluye leer los inactivos para reactivarlos).
DROP POLICY IF EXISTS "Admin gestiona talles" ON public.talles;
CREATE POLICY "Admin gestiona talles" ON public.talles
  FOR ALL TO authenticated
  USING (public.es_admin())
  WITH CHECK (public.es_admin());


-- ============================================================
-- 4. Índices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_talles_orden ON public.talles (orden);


-- ============================================================
-- VERIFICACIÓN
-- ============================================================
--   select nombre, orden, activo from public.talles order by orden;
--   select tablename, rowsecurity from pg_tables
--    where schemaname='public' and tablename='talles';
--   select policyname, cmd, roles from pg_policies
--    where schemaname='public' and tablename='talles';


-- ============================================================
-- REVERTIR
-- ============================================================
-- drop policy if exists "Talles visibles públicamente" on public.talles;
-- drop policy if exists "Admin gestiona talles" on public.talles;
-- drop table if exists public.talles;
-- ============================================================
