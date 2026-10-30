-- ============================================================
-- 030_promociones_producto_multiple.sql
--
-- Motor de promociones automáticas: un mismo producto puede participar en
-- más de una promoción activa al mismo tiempo (packs, combos, % OFF).
--
-- La relación productos <-> promociones ya es N:M (a través de
-- promocion_grupo_productos) y el motor de descuentos evalúa la combinación
-- más beneficiosa cuando varias promociones califican para el carrito.
--
-- Esta migración reemplaza el RPC `guardar_promocion` para retirar la regla
-- que impedía solapar un producto en dos promociones activas.
--
-- Requiere 029 (promociones + RPC guardar_promocion).
-- ============================================================


-- ============================================================
-- PRECHECK
-- ============================================================
DO $$
DECLARE
  faltan text[] := '{}';
BEGIN
  IF to_regclass('public.productos') IS NULL THEN
    faltan := faltan || 'public.productos (falta 001_initial.sql)';
  END IF;
  IF to_regclass('public.ordenes') IS NULL THEN
    faltan := faltan || 'public.ordenes (falta 001_initial.sql)';
  END IF;
  IF to_regprocedure('public.es_admin()') IS NULL THEN
    faltan := faltan || 'public.es_admin() (falta 012_auth.sql)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'ordenes' AND column_name = 'descuento_outfit'
  ) THEN
    faltan := faltan || 'ordenes.descuento_outfit (falta 023)';
  END IF;

  IF cardinality(faltan) > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = '029 no se puede aplicar: faltan migraciones previas.',
      DETAIL  = array_to_string(faltan, E'\n  - '),
      HINT    = 'Aplicá 019, 023 y 028 antes de correr 029.';
  END IF;

  RAISE NOTICE 'PRECHECK OK. Continuando con 029.';
END;
$$;


-- ============================================================
-- 1. Tablas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.promociones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL CHECK (length(btrim(nombre)) > 0),
  descripcion text,
  tipo text NOT NULL CHECK (tipo IN ('pack', 'combo')),
  descuento_porcentaje numeric
    CHECK (descuento_porcentaje IS NULL OR (descuento_porcentaje > 0 AND descuento_porcentaje <= 100)),
  precio_fijo numeric
    CHECK (precio_fijo IS NULL OR precio_fijo > 0),
  prioridad integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  fecha_inicio timestamptz,
  fecha_fin timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promociones_config_check CHECK (
    (tipo = 'pack' AND precio_fijo IS NOT NULL AND descuento_porcentaje IS NULL)
    OR
    (tipo = 'combo' AND descuento_porcentaje IS NOT NULL AND precio_fijo IS NULL)
  ),
  CONSTRAINT promociones_fechas_check CHECK (
    fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio
  )
);

CREATE TABLE IF NOT EXISTS public.promocion_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promocion_id uuid NOT NULL REFERENCES public.promociones(id) ON DELETE CASCADE,
  nombre text,
  cantidad_requerida integer NOT NULL DEFAULT 1 CHECK (cantidad_requerida > 0),
  orden integer NOT NULL DEFAULT 0,
  UNIQUE (promocion_id, orden)
);

CREATE TABLE IF NOT EXISTS public.promocion_grupo_productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.promocion_grupos(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  UNIQUE (grupo_id, producto_id)
);

CREATE INDEX IF NOT EXISTS idx_promociones_activas
  ON public.promociones (activo, prioridad DESC);

CREATE INDEX IF NOT EXISTS idx_promocion_grupos_promocion
  ON public.promocion_grupos (promocion_id, orden);

CREATE INDEX IF NOT EXISTS idx_promocion_grupo_productos_producto
  ON public.promocion_grupo_productos (producto_id);

COMMENT ON TABLE public.promociones IS
  'Promociones automáticas. pack = N unidades por precio fijo; combo = grupos con porcentaje.';
COMMENT ON COLUMN public.promociones.precio_fijo IS
  'Solo para tipo pack. Es el total a cobrar por cada pack de cantidad_requerida unidades.';
COMMENT ON COLUMN public.promociones.descuento_porcentaje IS
  'Solo para tipo combo. Porcentaje (1-100) sobre la suma de las unidades que forman el combo.';


-- ============================================================
-- 2. RLS
-- ============================================================
ALTER TABLE public.promociones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promocion_grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promocion_grupo_productos ENABLE ROW LEVEL SECURITY;

-- El catálogo necesita leer las promos vigentes para mostrar el descuento.
DROP POLICY IF EXISTS "Promociones vigentes publicas" ON public.promociones;
CREATE POLICY "Promociones vigentes publicas" ON public.promociones
  FOR SELECT TO anon, authenticated
  USING (activo = true);

DROP POLICY IF EXISTS "Admin gestiona promociones" ON public.promociones;
CREATE POLICY "Admin gestiona promociones" ON public.promociones
  FOR ALL TO authenticated
  USING (public.es_admin())
  WITH CHECK (public.es_admin());

DROP POLICY IF EXISTS "Grupos de promociones vigentes publicos" ON public.promocion_grupos;
CREATE POLICY "Grupos de promociones vigentes publicos" ON public.promocion_grupos
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.promociones p
       WHERE p.id = promocion_grupos.promocion_id
         AND p.activo = true
    )
  );

DROP POLICY IF EXISTS "Admin gestiona grupos de promociones" ON public.promocion_grupos;
CREATE POLICY "Admin gestiona grupos de promociones" ON public.promocion_grupos
  FOR ALL TO authenticated
  USING (public.es_admin())
  WITH CHECK (public.es_admin());

DROP POLICY IF EXISTS "Productos de promociones vigentes publicos" ON public.promocion_grupo_productos;
CREATE POLICY "Productos de promociones vigentes publicos" ON public.promocion_grupo_productos
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.promocion_grupos pg
        JOIN public.promociones p ON p.id = pg.promocion_id
       WHERE pg.id = promocion_grupo_productos.grupo_id
         AND p.activo = true
    )
  );

DROP POLICY IF EXISTS "Admin gestiona productos de promociones" ON public.promocion_grupo_productos;
CREATE POLICY "Admin gestiona productos de promociones" ON public.promocion_grupo_productos
  FOR ALL TO authenticated
  USING (public.es_admin())
  WITH CHECK (public.es_admin());


-- ============================================================
-- 3. Columnas de auditoría en la orden
-- ============================================================
ALTER TABLE public.ordenes
  ADD COLUMN IF NOT EXISTS descuento_promociones numeric NOT NULL DEFAULT 0;

ALTER TABLE public.ordenes
  ADD COLUMN IF NOT EXISTS promociones_aplicadas jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'ordenes_descuento_promociones_check'
       AND conrelid = 'public.ordenes'::regclass
  ) THEN
    ALTER TABLE public.ordenes
      ADD CONSTRAINT ordenes_descuento_promociones_check
      CHECK (descuento_promociones >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'ordenes_promociones_aplicadas_array'
       AND conrelid = 'public.ordenes'::regclass
  ) THEN
    ALTER TABLE public.ordenes
      ADD CONSTRAINT ordenes_promociones_aplicadas_array
      CHECK (jsonb_typeof(promociones_aplicadas) = 'array');
  END IF;
END;
$$;

COMMENT ON COLUMN public.ordenes.descuento_promociones IS
  'Descuento total de packs/combos automáticos. Calculado en crear-orden.';
COMMENT ON COLUMN public.ordenes.promociones_aplicadas IS
  'Detalle de promociones aplicadas: [{promocion_id,nombre,tipo,descuento,packs,conjuntos}].';


-- ============================================================
-- 4. RPC atómica para crear/editar una promoción
-- ============================================================
-- p_payload:
-- {
--   "id": "uuid opcional",
--   "nombre": "2x remeras",
--   "descripcion": "...",
--   "tipo": "pack" | "combo",
--   "descuento_porcentaje": 15,      -- combo
--   "precio_fijo": 35000,            -- pack
--   "prioridad": 0,
--   "activo": true,
--   "fecha_inicio": "2026-11-01T00:00:00Z" | null,
--   "fecha_fin": "2026-11-30T23:59:59Z" | null,
--   "grupos": [
--     { "nombre": "Remeras", "cantidad_requerida": 2, "producto_ids": ["uuid", ...] }
--   ]
-- }
CREATE OR REPLACE FUNCTION public.guardar_promocion(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := NULLIF(btrim(COALESCE(p_payload->>'id', '')), '')::uuid;
  v_nombre text := btrim(COALESCE(p_payload->>'nombre', ''));
  v_tipo text := COALESCE(p_payload->>'tipo', '');
  v_precio_fijo numeric := NULLIF(p_payload->>'precio_fijo', '')::numeric;
  v_descuento numeric := NULLIF(p_payload->>'descuento_porcentaje', '')::numeric;
  v_grupos jsonb := COALESCE(p_payload->'grupos', '[]'::jsonb);
  v_grupo jsonb;
  v_grupo_id uuid;
  v_productos uuid[];
  v_todos_productos uuid[] := '{}';
  v_orden integer := 0;
BEGIN
  IF NOT public.es_admin() THEN
    RAISE EXCEPTION 'No autorizado.' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ikigai:promociones', 0));

  IF v_nombre = '' THEN
    RAISE EXCEPTION 'El nombre de la promoción es obligatorio.';
  END IF;

  IF v_tipo NOT IN ('pack', 'combo') THEN
    RAISE EXCEPTION 'El tipo debe ser pack o combo.';
  END IF;

  IF jsonb_typeof(v_grupos) <> 'array' OR jsonb_array_length(v_grupos) = 0 THEN
    RAISE EXCEPTION 'La promoción necesita al menos un grupo.';
  END IF;

  IF v_tipo = 'pack' THEN
    IF jsonb_array_length(v_grupos) <> 1 THEN
      RAISE EXCEPTION 'Un pack debe tener exactamente un grupo.';
    END IF;
    IF v_precio_fijo IS NULL OR v_precio_fijo <= 0 THEN
      RAISE EXCEPTION 'El pack necesita un precio fijo mayor a 0.';
    END IF;
    IF v_descuento IS NOT NULL THEN
      RAISE EXCEPTION 'El pack no lleva porcentaje de descuento.';
    END IF;
    IF COALESCE((v_grupos->0->>'cantidad_requerida')::integer, 0) < 2 THEN
      RAISE EXCEPTION 'El pack debe llevar al menos 2 unidades.';
    END IF;
  ELSE
    IF jsonb_array_length(v_grupos) < 2 THEN
      RAISE EXCEPTION 'Un combo debe tener al menos dos grupos.';
    END IF;
    IF v_descuento IS NULL OR v_descuento <= 0 OR v_descuento > 100 THEN
      RAISE EXCEPTION 'El combo necesita un porcentaje entre 1 y 100.';
    END IF;
    IF v_precio_fijo IS NOT NULL THEN
      RAISE EXCEPTION 'El combo no lleva precio fijo.';
    END IF;
  END IF;

  IF v_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.promociones WHERE id = v_id) THEN
    RAISE EXCEPTION 'La promoción que intentás editar no existe.';
  END IF;

  -- Recolectar y validar todos los productos.
  FOR v_grupo IN SELECT * FROM jsonb_array_elements(v_grupos)
  LOOP
    v_productos := ARRAY(
      SELECT DISTINCT x::uuid
        FROM jsonb_array_elements_text(COALESCE(v_grupo->'producto_ids', '[]'::jsonb)) AS x
    );

    IF COALESCE(array_length(v_productos, 1), 0) = 0 THEN
      RAISE EXCEPTION 'Cada grupo debe tener al menos un producto.';
    END IF;

    IF COALESCE((v_grupo->>'cantidad_requerida')::integer, 0) < 1 THEN
      RAISE EXCEPTION 'La cantidad requerida de cada grupo debe ser mayor a 0.';
    END IF;

    v_todos_productos := v_todos_productos || v_productos;
  END LOOP;

  IF array_length(v_todos_productos, 1) <>
     (SELECT count(DISTINCT x) FROM unnest(v_todos_productos) AS x)
  THEN
    RAISE EXCEPTION 'Un producto no puede estar en más de un grupo de la misma promoción.';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM unnest(v_todos_productos) AS pid
      LEFT JOIN public.productos p ON p.id = pid
     WHERE p.id IS NULL OR p.activo = false
  ) THEN
    RAISE EXCEPTION 'Todos los productos deben existir y estar activos.';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.promociones (
      nombre, descripcion, tipo, descuento_porcentaje, precio_fijo,
      prioridad, activo, fecha_inicio, fecha_fin, updated_at
    ) VALUES (
      v_nombre,
      NULLIF(btrim(COALESCE(p_payload->>'descripcion', '')), ''),
      v_tipo,
      v_descuento,
      v_precio_fijo,
      COALESCE((p_payload->>'prioridad')::integer, 0),
      COALESCE((p_payload->>'activo')::boolean, true),
      NULLIF(btrim(COALESCE(p_payload->>'fecha_inicio', '')), '')::timestamptz,
      NULLIF(btrim(COALESCE(p_payload->>'fecha_fin', '')), '')::timestamptz,
      now()
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.promociones
       SET nombre = v_nombre,
           descripcion = NULLIF(btrim(COALESCE(p_payload->>'descripcion', '')), ''),
           tipo = v_tipo,
           descuento_porcentaje = v_descuento,
           precio_fijo = v_precio_fijo,
           prioridad = COALESCE((p_payload->>'prioridad')::integer, 0),
           activo = COALESCE((p_payload->>'activo')::boolean, true),
           fecha_inicio = NULLIF(btrim(COALESCE(p_payload->>'fecha_inicio', '')), '')::timestamptz,
           fecha_fin = NULLIF(btrim(COALESCE(p_payload->>'fecha_fin', '')), '')::timestamptz,
           updated_at = now()
     WHERE id = v_id;

    DELETE FROM public.promocion_grupos WHERE promocion_id = v_id;
  END IF;

  FOR v_grupo IN SELECT * FROM jsonb_array_elements(v_grupos)
  LOOP
    INSERT INTO public.promocion_grupos (
      promocion_id, nombre, cantidad_requerida, orden
    ) VALUES (
      v_id,
      COALESCE(NULLIF(btrim(COALESCE(v_grupo->>'nombre', '')), ''), 'Grupo ' || (v_orden + 1)),
      (v_grupo->>'cantidad_requerida')::integer,
      v_orden
    )
    RETURNING id INTO v_grupo_id;

    INSERT INTO public.promocion_grupo_productos (grupo_id, producto_id)
    SELECT DISTINCT v_grupo_id, x::uuid
      FROM jsonb_array_elements_text(COALESCE(v_grupo->'producto_ids', '[]'::jsonb)) AS x;

    v_orden := v_orden + 1;
  END LOOP;

  RETURN v_id;
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Hay ids o valores numéricos inválidos en la promoción.';
END;
$$;

REVOKE ALL ON FUNCTION public.guardar_promocion(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guardar_promocion(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.guardar_promocion(jsonb) TO authenticated;


-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- Tablas y RLS:
--   select tablename, rowsecurity from pg_tables
--    where schemaname = 'public'
--      and tablename in ('promociones','promocion_grupos','promocion_grupo_productos');
--
-- Columnas en órdenes:
--   select column_name, data_type, column_default
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'ordenes'
--      and column_name in ('descuento_promociones','promociones_aplicadas');
--
-- RPC:
--   select has_function_privilege('authenticated', 'public.guardar_promocion(jsonb)', 'EXECUTE');


-- ============================================================
-- REVERTIR (solo desarrollo)
-- ============================================================
-- drop function if exists public.guardar_promocion(jsonb);
-- drop table if exists public.promocion_grupo_productos;
-- drop table if exists public.promocion_grupos;
-- drop table if exists public.promociones;
-- alter table public.ordenes drop column if exists descuento_promociones;
-- alter table public.ordenes drop column if exists promociones_aplicadas;
