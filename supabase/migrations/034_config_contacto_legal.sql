drop policy if exists "Config pública para la tienda" on public.config_tienda;

create policy "Config pública para la tienda" on public.config_tienda
  for select to public
  using (
    clave in (
      'umbral_envio_gratis',
      'envio_gratis_activo',
      'descuento_transferencia',
      'cuotas_sin_interes',
      'whatsapp',
      'email_contacto',
      'instagram',
      'nombre_tienda',
      'imagen_showroom',
      'direccion',
      'horario_atencion',
      'razon_social',
      'cuit',
      'data_fiscal_url'
    )
  );

insert into config_tienda (clave, valor, descripcion) values
  ('direccion', 'Mosconi 331, Oberá, Misiones', 'Dirección del showroom que se muestra en el pie de página'),
  ('horario_atencion', 'Lun a Sáb · 10 a 20 hs', 'Horario de atención que se muestra en el pie de página'),
  ('razon_social', 'IKIGAI CLOTHES', 'Razón social o nombre legal que se muestra en el pie de página'),
  ('cuit', '', 'CUIT/CUIL de la tienda; se muestra en el pie de página si está cargado'),
  ('data_fiscal_url', '', 'URL del Data Fiscal; se muestra en el pie de página si está cargada')
on conflict (clave) do nothing;
