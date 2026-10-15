-- ============================================================
-- 026_productos_proximos.sql
--
-- Los productos de drops futuros deben aparecer en el catálogo
-- (categorías, búsqueda y relacionadas) difuminados con el título
-- "Próximamente...", pero sin filtrar por fecha como hacía 025.
--
-- Para no romper la seguridad de la Opción B (RLS), NO se relaja
-- la política pública de `productos`: en cambio, esta función
-- SECURITY DEFINER devuelve esos productos con los datos
-- sensibles ENMASCARADOS:
--   nombre      -> 'Próximamente...'
--   descripcion -> NULL
--   precio      -> 0 / precio_transferencia -> NULL
--   imagenes    -> sólo la portada
--   stock       -> (lo sigue ocultando la RLS de variaciones_stock)
--
-- Así el catálogo puede renderizar una tarjeta bloqueada sin que
-- la API pública jamás exponga el nombre ni el precio real.
--
-- Aplicar con:
--   npx supabase db query --linked -f supabase/migrations/026_productos_proximos.sql
-- ============================================================


-- Requiere que 001_initial.sql y 025_drops_temporizador.sql ya estén aplicadas
-- (tablas `productos` y `drops`, y la función `drop_preview`).


-- ============================================================
-- Catálogo de drops futuros (datos enmascarados)
-- ============================================================
-- `p_categoria` y `p_buscar` son opcionales: permiten que el
-- catálogo filtre y busque igual que con los productos normales.
-- La búsqueda compara contra el nombre REAL (server-side), así un
-- drop futuro se puede encontrar tecleando su nombre, pero se
-- devuelve con el título enmascarado.
CREATE OR REPLACE FUNCTION public.productos_proximos(
  p_categoria text DEFAULT NULL,
  p_buscar    text DEFAULT NULL
)
RETURNS TABLE (
  id                  uuid,
  nombre              text,
  descripcion         text,
  categoria           text,
  precio              numeric,
  precio_transferencia numeric,
  discount_percent    integer,
  imagenes            text[],
  activo              boolean,
  drop_id             uuid,
  created_at          timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    p.id,
    'Próximamente...'::text                                       AS nombre,
    NULL::text                                                    AS descripcion,
    p.categoria                                                   AS categoria,
    0::numeric                                                    AS precio,
    NULL::numeric                                                 AS precio_transferencia,
    0::integer                                                    AS discount_percent,
    CASE WHEN coalesce(array_length(p.imagenes, 1), 0) >= 1
         THEN array[p.imagenes[1]]
         ELSE '{}'::text[]
    END                                                           AS imagenes,
    p.activo                                                      AS activo,
    p.drop_id                                                     AS drop_id,
    p.created_at                                                  AS created_at
  FROM public.productos p
  JOIN public.drops d ON d.id = p.drop_id
  WHERE p.activo
    AND d.activo
    AND d.fecha_lanzamiento > now()
    AND (p_categoria IS NULL OR p.categoria = p_categoria)
    AND (
      p_buscar IS NULL
      OR btrim(p_buscar) = ''
      OR p.nombre     ILIKE '%' || p_buscar || '%'
      OR p.categoria  ILIKE '%' || p_buscar || '%'
    )
  ORDER BY p.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.productos_proximos(text, text) TO anon, authenticated;


-- ============================================================
-- VERIFICACIÓN
-- ============================================================
--   -- Enmascarado (no debe aparecer el nombre real ni el precio):
--   select id, nombre, precio, descripcion, imagenes
--     from public.productos_proximos();
--   -- Con filtros:
--   select id, nombre from public.productos_proximos('remeras', 'over');
--   select proname, prosecdef from pg_proc
--    where proname = 'productos_proximos';
--   -- La RLS sigue ocultando el dato real a la API pública:
--   select id, nombre from public.productos where drop_id is not null;


-- ============================================================
-- REVERTIR
-- ============================================================
-- drop function if exists public.productos_proximos(text, text);
