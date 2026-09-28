-- ============================================
-- IKIGAI CLOTHES - Migración 012: Supabase Auth
-- ============================================

-- ------------------------------------------------------------
-- PERFILES: tabla vinculada a los usuarios de auth.users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.perfiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  nombre text,
  es_admin boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "El usuario lee su propio perfil" ON public.perfiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "El usuario edita su propio perfil" ON public.perfiles
  FOR UPDATE USING (auth.uid() = id);

-- Trigger: crea el perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper para futuras políticas de admin basadas en perfiles
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT es_admin FROM public.perfiles WHERE id = auth.uid()), false);
$$;

-- ------------------------------------------------------------
-- MIS PEDIDOS: lectura de órdenes propias (por email)
-- ------------------------------------------------------------

CREATE POLICY "El usuario lee sus propias órdenes" ON public.ordenes
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND cliente_email = auth.jwt() ->> 'email'
  );

CREATE POLICY "El usuario lee los items de sus órdenes" ON public.orden_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ordenes o
      WHERE o.id = orden_items.orden_id
        AND o.cliente_email = auth.jwt() ->> 'email'
    )
  );

CREATE INDEX idx_ordenes_cliente_email ON public.ordenes(cliente_email);

-- ------------------------------------------------------------
-- NOTA DE SEGURIDAD (ADMIN)
-- ------------------------------------------------------------
-- Las políticas de administración actuales utilizan
--   auth.role() = 'authenticated'
-- lo que en la práctica otorga permisos de admin a CUALQUIER usuario
-- registrado. Antes de exponer el registro público de la tienda conviene
-- reemplazarlas por una verificación de rol, por ejemplo:
--
--   DROP POLICY "Admin gestiona productos" ON productos;
--   CREATE POLICY "Admin gestiona productos" ON productos
--     FOR ALL USING (public.es_admin());
--
-- (repetir para variaciones_stock, outfits, outfit_items, resenas,
--  comunidad_fotos, ordenes y orden_items). Este archivo NO aplica ese
-- cambio para no romper la administración vigente del panel.