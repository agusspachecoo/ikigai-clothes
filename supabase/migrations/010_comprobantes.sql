-- Bucket de Storage para comprobantes de pago
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes', 'comprobantes', true)
ON CONFLICT (id) DO NOTHING;

-- Política: cualquiera puede subir comprobantes (guest checkout)
CREATE POLICY "Anyone can upload comprobantes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'comprobantes');

-- Política: cualquiera puede leer comprobantes (para admin y preview)
CREATE POLICY "Anyone can view comprobantes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'comprobantes');
