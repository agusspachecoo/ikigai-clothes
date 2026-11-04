-- ============================================================
-- 031_categorias_destacadas.sql
--
-- Permite elegir desde el panel qué categorías se muestran en la
-- grilla de categorías del Home.
--
-- Las categorías existentes quedan marcadas como destacadas para no
-- cambiar el Home actual. Las nuevas se crean ocultas (false) hasta
-- que el admin las marque explícitamente.
-- ============================================================


-- ============================================================
-- PRECHECK
-- ============================================================
DO $$
DECLARE
  faltan text[] := '{}';
BEGIN
  IF to_regclass('public.categorias') IS NULL THEN
    faltan := faltan || 'public.categorias (falta 003_dynamic_categories.sql)';
  END IF;

  IF cardinality(faltan) > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = '031 no se puede aplicar: falta una migración previa.',
      DETAIL  = array_to_string(faltan, E'\n  - '),
      HINT    = 'Aplicá 003_dynamic_categories.sql antes de correr 031.';
  END IF;

  RAISE NOTICE 'PRECHECK OK. Continuando con 031.';
END;
$$;


-- ============================================================
-- 1. Campo destacada
-- ============================================================
ALTER TABLE public.categorias ADD COLUMN IF NOT EXISTS destacada boolean;

UPDATE public.categorias
   SET destacada = true
 WHERE destacada IS NULL;

ALTER TABLE public.categorias ALTER COLUMN destacada SET DEFAULT false;
ALTER TABLE public.categorias ALTER COLUMN destacada SET NOT NULL;

COMMENT ON COLUMN public.categorias.destacada IS
  'Si es true, la categoría aparece en la grilla de categorías destacadas del Home.';


-- ============================================================
-- 2. Índice para la lectura pública del Home
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_categorias_destacadas
  ON public.categorias (nombre)
  WHERE destacada;


-- ============================================================
-- 3. Refrescar la caché de PostgREST (Supabase API)
-- ============================================================
-- Sin esto, la API puede seguir respondiendo "column categorias.destacada
-- does not exist" hasta que se reinicie el servicio o se recargue el
-- esquema. Es idempotente y seguro de ejecutar en cada migración.
NOTIFY pgrst, 'reload schema';


-- ============================================================
-- VERIFICACIÓN
-- ============================================================
--   select nombre, slug, destacada, imagen_url
--     from public.categorias
--    order by nombre;


-- ============================================================
-- REVERTIR
-- ============================================================
-- drop index if exists public.idx_categorias_destacadas;
-- alter table public.categorias drop column if exists destacada;
-- ============================================================
