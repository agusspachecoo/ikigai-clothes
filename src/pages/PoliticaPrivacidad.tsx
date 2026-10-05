import { PaginaInstitucional } from '../components/PaginaInstitucional'
import { useSeo } from '../hooks/useSeo'
import { CONTACTO, SHOWROOM } from '../lib/contacto'

export function PoliticaPrivacidad() {
  useSeo()

  return (
    <PaginaInstitucional
      titulo="Política de Privacidad"
      bajada="Cómo tratamos los datos personales que compartís con Ikigai Clothes al comprar en esta tienda."
    >
      <section>
        <h2 className="font-display text-lg mb-2">Quién es el responsable</h2>
        <p>
          Ikigai Clothes es una marca de indumentaria urbana que vende de forma directa desde Oberá,
          Misiones, Argentina. Para cualquier consulta sobre tus datos podés escribirnos a{' '}
          <a href={`mailto:${CONTACTO.email}`} className="underline">
            {CONTACTO.email}
          </a>{' '}
          o por{' '}
          <a href={CONTACTO.whatsapp} target="_blank" rel="noopener noreferrer" className="underline">
            WhatsApp {CONTACTO.whatsappVisible}
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Qué datos recogemos</h2>
        <p>
          Para procesar un pedido necesitamos que nos entregues: nombre, apellido, email, teléfono,
          DNI y dirección de entrega con su código postal. Esses datos son obligatorios porque los
          exige la plataforma de pago y el correo que despacha el pedido.
        </p>
        <p className="mt-2">
          También podemos guardar tu dirección en el navegador para que no la vuelvas a cargar, y
          opcionalmente tu email si te suscribís al newsletter.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Para qué los usamos</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Procesar y enviar tu compra.</li>
          <li>Emitir comprobantes y gestionar cambios o devoluciones.</li>
          <li>Atender consultas por WhatsApp o correo.</li>
          <li>Enviarte novedades solo si lo autorizás.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Con quién los compartimos</h2>
        <p>
          Para que la compra llegue, tus datos se comparten con Mercado Pago (procesa el pago), con
          la empresa de correo o courier que despacha el pedido (solo recibe nombre, dirección y
          teléfono) y con los proveedores de infraestructura que alojan la tienda. No vendemos ni
          cedemos tus datos con fines comerciales.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Tus derechos</h2>
        <p>
          Conforme a la Ley 25.326 de Protección de Datos Personales, podés pedirnos información
          sobre los datos que tenemos de vos, corregirlos o pedir su eliminación. Escribinos y lo
          resolvemos dentro de los plazos legales. También podés registrarte ante la Agencia de
          Acceso a la Información Pública.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Cookies y almacenamiento local</h2>
        <p>
          Usamos almacenamiento local del navegador para recordar tu carrito y tus preferencias. Eso
          es estrictamente funcional y lo hacemos sin pedirte permiso, porque sin eso la compra no
          podría completarse.
        </p>
        <p className="mt-2">
          Además, si en el banner de cookies elegís &ldquo;aceptar todo&rdquo;, cargamos Google
          Analytics 4 para ver cómo se usa el sitio de forma agregada. Si elegís
          &ldquo;solo lo esencial&rdquo;, ese script nunca se descarga. Podés cambiar tu decisión
          cuando quieras desde el enlace &ldquo;Preferencias de cookies&rdquo; del pie de página.
        </p>
        <p className="mt-2">
          No usamos cookies publicitarias, no vendemos tus datos y no compartimos información
          personal con terceros con fines de marketing. Podés borrar el almacenamiento del sitio
          desde la configuración de tu navegador sin que se afecte la compra en curso.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Cambios en esta política</h2>
        <p>
          Si actualizamos esta política, publicaremos la versión vigente en esta misma página con
          su fecha de actualización. Última actualización: enero de 2026.
        </p>
      </section>

      <p className="text-xs opacity-60">
        Showroom: {SHOWROOM.direccion}. {SHOWROOM.horario}.
      </p>
    </PaginaInstitucional>
  )
}
