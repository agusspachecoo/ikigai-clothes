-- ============================================================
-- 033_variantes_color_modelo.sql
--
-- Agrupa productos por color/modelo sin perder cada color como
-- producto independiente del catálogo (precio, stock y URL propios).
--
-- Los productos que comparten `grupo_modelo` se enlazan entre sí en
-- la ficha de producto mediante un selector de colores.
-- ============================================================


-- ============================================================
-- PRECHECK
-- ============================================================
DO $$
BEGIN
  IF to_regclass('public.productos') IS NULL THEN
    RAISE EXCEPTION '033 no se puede aplicar: falta public.productos.';
  END IF;

  RAISE NOTICE 'PRECHECK OK. Continuando con 033.';
END;
$$;


-- ============================================================
-- 1. Columnas de agrupación y color
-- ============================================================
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS grupo_modelo text;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS color_hex text;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS color_nombre text;

COMMENT ON COLUMN public.productos.grupo_modelo IS
  'Identificador del modelo compartido por sus variantes de color (ej: remera oversize ikigai). NULL = producto sin variantes agrupadas.';
COMMENT ON COLUMN public.productos.color_hex IS
  'Color de la variante en formato hexadecimal, ej: #1A1A1A.';
COMMENT ON COLUMN public.productos.color_nombre IS
  'Nombre visible del color, ej: Negro, Beige, Azul lavado.';


-- ============================================================
-- 2. Índice para buscar las variantes de un mismo modelo
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_productos_grupo_modelo
  ON public.productos (grupo_modelo);


-- ============================================================
-- 3. Refrescar la caché de PostgREST (Supabase API)
-- ============================================================
NOTIFY pgrst, 'reload schema';


-- ============================================================
-- VERIFICACIÓN
-- ============================================================
--   select id, nombre, grupo_modelo, color_hex, color_nombre
--     from public.productos
--    where grupo_modelo is not null
--    order by grupo_modelo, nombre;
--
-- Cada producto sigue teniendo su propio precio, imágenes y stock.


-- ============================================================
-- REVERTIR
-- ============================================================
-- drop index if exists public.idx_productos_grupo_modelo;
-- alter table public.productos drop column if exists color_nombre;
-- alter table public.productos drop column if exists color_hex;
-- alter table public.productos drop column if exists grupo_modelo;
-- ============================================================
