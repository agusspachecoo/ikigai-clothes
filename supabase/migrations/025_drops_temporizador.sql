-- ============================================================
-- 025_drops_temporizador.sql
--
-- Sistema de Drops / Lanzamientos Exclusivos.
--
-- Permite agrupar productos nuevos bajo un "drop" con fecha de
-- lanzamiento. Mientras el drop no se lanzó, sus productos NO son
-- visibles en el catálogo, la búsqueda, las relacionadas ni la
-- ficha: la RLS de `productos` los oculta al público hasta que
-- pase `fecha_lanzamiento`. La Home sí puede mostrarlos como
-- "próximamente" (difuminados), pero sólo exponiendo la primera
-- imagen a través de la función `drop_preview`, nunca el nombre ni
-- el precio.
--
-- Al pasar la fecha, la RLS habilita los productos automáticamente:
-- no hace falta ningún cron ni activación manual.
--
-- Aplicar con:
--   npx supabase db query --linked -f supabase/migrations/025_drops_temporizador.sql
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

  IF to_regclass('public.productos') IS NULL THEN
    faltan := faltan || 'public.productos (falta 001_initial.sql)';
  END IF;

  IF cardinality(faltan) > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = '025 no se puede aplicar: falta migración previa.',
      DETAIL  = array_to_string(faltan, E'\n  - '),
      HINT    = 'Aplicá 001_initial.sql y 018_admin_rls.sql antes de correr 025.';
  END IF;

  RAISE NOTICE 'PRECHECK OK. Continuando con 025.';
END;
$$;


-- ============================================================
-- 1. Tabla drops
-- ============================================================
CREATE TABLE IF NOT EXISTS public.drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descripcion text,
  fecha_lanzamiento timestamptz NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.drops IS
  'Lanzamientos exclusivos con fecha. Los productos asociados quedan ocultos al público hasta fecha_lanzamiento.';


-- ============================================================
-- 2. Relación productos.drop_id
-- ============================================================
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS drop_id uuid REFERENCES public.drops(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.productos.drop_id IS
  'Drop al que pertenece el producto. NULL = catálogo normal.';


-- ============================================================
-- 3. RLS de drops
-- ============================================================
ALTER TABLE public.drops ENABLE ROW LEVEL SECURITY;

-- El público ve los drops activos (para el temporizador de la Home).
DROP POLICY IF EXISTS "Drops visibles públicamente" ON public.drops;
CREATE POLICY "Drops visibles públicamente" ON public.drops
  FOR SELECT TO public
  USING (activo);

-- El admin gestiona todo (incluye inactivos).
DROP POLICY IF EXISTS "Admin gestiona drops" ON public.drops;
CREATE POLICY "Admin gestiona drops" ON public.drops
  FOR ALL TO authenticated
  USING (public.es_admin())
  WITH CHECK (public.es_admin());


-- ============================================================
-- 4. RLS de productos: ocultar los de drops futuros
-- ============================================================
-- Reemplaza la política de 001_initial.sql. Un producto se ve si
-- está activo y, o bien no pertenece a ningún drop, o su drop ya
-- se lanzó.
DROP POLICY IF EXISTS "Productos visibles públicamente" ON public.productos;
CREATE POLICY "Productos visibles públicamente" ON public.productos
  FOR SELECT TO public
  USING (
    activo
    AND (
      drop_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.drops d
        WHERE d.id = productos.drop_id
          AND d.fecha_lanzamiento <= now()
      )
    )
  );


-- ============================================================
-- 5. RLS de stock: no revelar stock de drops futuros
-- ============================================================
-- Reemplaza la política de 018_admin_rls.sql para que el stock
-- público tampoco delate un producto aún no lanzado.
DROP POLICY IF EXISTS "Stock visible públicamente" ON public.variaciones_stock;
CREATE POLICY "Stock visible públicamente" ON public.variaciones_stock
  FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.productos p
      WHERE p.id = variaciones_stock.producto_id
        AND p.activo
        AND (
          p.drop_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.drops d
            WHERE d.id = p.drop_id
              AND d.fecha_lanzamiento <= now()
          )
        )
    )
  );


-- ============================================================
-- 6. Vista previa de drops futuros
-- ============================================================
-- La Home necesita mostrar las tarjetas difuminadas de un drop que
-- todavía no se lanzó. Como la RLS de `productos` las oculta, esta
-- función SECURITY DEFINER expone SÓLO el id y la primera imagen,
-- nunca nombre ni precio, y únicamente para drops activos y futuros.
CREATE OR REPLACE FUNCTION public.drop_preview(p_drop_id uuid)
RETURNS TABLE (producto_id uuid, imagen text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.id, p.imagenes[1]
  FROM public.productos p
  JOIN public.drops d ON d.id = p.drop_id
  WHERE d.id = p_drop_id
    AND d.activo
    AND d.fecha_lanzamiento > now()
  ORDER BY p.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.drop_preview(uuid) TO anon, authenticated;


-- ============================================================
-- 7. Índices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_drops_activo_fecha ON public.drops (activo, fecha_lanzamiento);
CREATE INDEX IF NOT EXISTS idx_productos_drop ON public.productos (drop_id);


-- ============================================================
-- VERIFICACIÓN
-- ============================================================
--   select id, titulo, fecha_lanzamiento, activo from public.drops order by fecha_lanzamiento;
--   select policyname, cmd, roles from pg_policies
--    where schemaname='public' and tablename in ('drops','productos','variaciones_stock');
--   select proname, prosecdef from pg_proc where proname = 'drop_preview';
--   -- Producto futuro (no debería aparecer para anon):
--   select id, nombre from public.productos where drop_id is not null;


-- ============================================================
-- REVERTIR
-- ============================================================
-- drop function if exists public.drop_preview(uuid);
-- drop policy if exists "Drops visibles públicamente" on public.drops;
-- drop policy if exists "Admin gestiona drops" on public.drops;
-- drop index if exists public.idx_productos_drop;
-- drop index if exists public.idx_drops_activo_fecha;
-- alter table public.productos drop column if exists drop_id;
-- drop table if exists public.drops;
-- -- Restaurar políticas originales:
-- drop policy if exists "Productos visibles públicamente" on public.productos;
-- create policy "Productos visibles públicamente" on public.productos
--   for select to public using (activo);
-- drop policy if exists "Stock visible públicamente" on public.variaciones_stock;
-- create policy "Stock visible públicamente" on public.variaciones_stock
--   for select to public using (
--     exists (select 1 from public.productos p where p.id = variaciones_stock.producto_id and p.activo)
--   );
-- ============================================================
