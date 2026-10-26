DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'comprobantes') THEN
    RAISE EXCEPTION 'Falta el bucket comprobantes (010_comprobantes.sql).';
  END IF;
END;
$$;

DROP POLICY IF EXISTS "Invitado sube su comprobante de transferencia" ON storage.objects;

CREATE POLICY "Invitado sube su comprobante de transferencia" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'comprobantes'
    AND (storage.foldername(name))[1] = 'comprobantes'
  );
