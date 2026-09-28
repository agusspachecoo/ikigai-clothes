-- ============================================
-- IKIGAI CLOTHES - Migración 013: Campos opcionales en perfiles
-- ============================================

-- Campos de datos personales opcionales
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS apellido text,
  ADD COLUMN IF NOT EXISTS dni text,
  ADD COLUMN IF NOT EXISTS telefono text;

-- Permite al usuario crear su propio perfil si por algún motivo no existiera
CREATE POLICY "El usuario crea su propio perfil" ON public.perfiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Reseñas: solo usuarios con sesión activa pueden publicar
DROP POLICY IF EXISTS "Cualquiera puede insertar reseña" ON public.resenas;
CREATE POLICY "Solo usuarios autenticados pueden insertar reseñas" ON public.resenas
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');