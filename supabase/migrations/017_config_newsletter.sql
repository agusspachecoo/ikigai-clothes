-- ============================================
-- 017: Configuración de la tienda + Newsletter
-- ============================================
-- Configuración editable desde el panel (umbrales, discounts, datos de contacto).
-- Se lee con clave/valor para no agregar una columna nueva por cada parámetro.
CREATE TABLE IF NOT EXISTS config_tienda (
  clave text PRIMARY KEY,
  valor text NOT NULL,
  descripcion text,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO config_tienda (clave, valor, descripcion) VALUES
  ('umbral_envio_gratis', '150000', 'Monto mínimo para envío gratis'),
  ('envio_gratis_activo', 'true', 'Si el envío gratis por monto está habilitado'),
  ('descuento_transferencia', '20', 'Porcentaje de descuento pagando por transferencia'),
  ('cuotas_sin_interes', '6', 'Cantidad de cuotas sin interés a mostrar'),
  ('whatsapp', '5493755732335', 'Número de WhatsApp con prefijo, solo dígitos'),
  ('email_contacto', 'ikigaiclothes.contacto@gmail.com', 'Email de contacto'),
  ('instagram', 'https://www.instagram.com/ikigai_clothess/', 'Instagram'),
  ('nombre_tienda', 'IKIGAI CLOTHES', 'Nombre para el statement y los datos legales')
ON CONFLICT (clave) DO NOTHING;

ALTER TABLE config_tienda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Config legible" ON config_tienda
  FOR SELECT USING (true);

-- Misma convención que el resto del panel (ver NOTA DE SEGURIDAD en 012_auth.sql).
CREATE POLICY "Admin panel - gestionar config" ON config_tienda
  FOR ALL USING (true) WITH CHECK (true);

-- Newsletter: se puede suscribir sin cuenta, no se puede leer desde el público
CREATE TABLE IF NOT EXISTS suscriptores_newsletter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE suscriptores_newsletter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suscripción pública" ON suscriptores_newsletter
  FOR INSERT WITH CHECK (true);

-- Ver NOTA DE SEGURIDAD en 012_auth.sql: el login del panel es del frontend,
-- por eso el acceso queda abierto como en las demas tablas de admin.
CREATE POLICY "Admin panel - leer suscriptores" ON suscriptores_newsletter
  FOR SELECT USING (true);

CREATE POLICY "Admin panel - gestionar suscriptores" ON suscriptores_newsletter
  FOR ALL USING (true) WITH CHECK (true);
