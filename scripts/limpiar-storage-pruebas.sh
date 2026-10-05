#!/usr/bin/env bash
# Borra los objetos de prueba que deja `verificar-storage.sh`.
#
#   bash scripts/limpiar-storage-pruebas.sh
#   SUPABASE_SERVICE_ROLE_KEY=... bash scripts/limpinar-storage-pruebas.sh
#
# El script de verificación deja dos objetos de 16 bytes por corrida (uno en
# product-images/reviews/ y otro en comprobantes/comprobantes/) porque probar
# que el anónimo NO puede borrar implica que no se puedan borrar con la anon
# key. Si no se limpian a mano, se van acumulando en el bucket.
#
# Necesita una service_role key: el DELETE directo por SQL sobre
# storage.objects está bloqueado por el trigger storage.protect_delete.
set -uo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-djixdahosjjnszuafgsw}"
KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [ -z "$KEY" ]; then
  # La CLI expone las keys del proyecto; se usa la service_role sin guardarla.
  if command -v npx >/dev/null 2>&1; then
    KEY="$(npx supabase projects api-keys --project-ref "$PROJECT_REF" 2>/dev/null \
      | awk '/service_role/ {print $NF}')"
  fi
fi

[ -n "$KEY" ] || {
  echo "Falta la service_role key."
  echo ""
  echo "Pasala por variable de entorno:"
  echo "  SUPABASE_SERVICE_ROLE_KEY=<key> bash scripts/limpiar-storage-pruebas.sh"
  echo ""
  echo "O borralos desde el Dashboard > Storage."
  exit 1
}

URL="${SUPABASE_URL:-https://$PROJECT_REF.supabase.co}"
URL="${URL%/}"

# Se listan los objetos de prueba con la CLI (no necesita service_role).
LISTA="$(mktemp)"
trap 'rm -f "$LISTA"' EXIT
printf "select bucket_id || '/' || name as ruta from storage.objects where name like '%%verificacion-021%%';\n" > "$LISTA"

rutas="$(
  npx supabase db query --linked -f "$LISTA" 2>/dev/null \
    | sed 's/[│|]//g' | tr -d ' ' | grep '^comprobantes/\|^product-images/' || true
)"

if [ -z "$rutas" ]; then
  echo "No hay objetos de prueba para borrar."
  exit 0
fi

borrados=0
fallos=0

while read -r ruta; do
  [ -n "$ruta" ] || continue
  # Se reintenta: la API de Storage devuelve 504 esporádicamente cuando hay
  # varias peticiones seguidas.
  for intento in 1 2 3; do
    code="$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$URL/storage/v1/object/$ruta" \
      -H "apikey: $KEY" -H "Authorization: Bearer $KEY")"
    if [ "$code" = "200" ] || [ "$code" = "204" ]; then
      echo "  OK    borrado: $ruta"
      borrados=$((borrados + 1))
      break
    fi
    if [ "$intento" = "3" ]; then
      echo "  FALLA $ruta (HTTP $code)"
      fallos=$((fallos + 1))
    else
      sleep 2
    fi
  done
done <<< "$rutas"

echo ""
echo "Borrados: $borrados | Fallos: $fallos"

[ "$fallos" -eq 0 ] || exit 1