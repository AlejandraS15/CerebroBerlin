#!/usr/bin/env bash
# Reconstruye el lago desde cero y lo valida (puerta de publicación).
#
# Borra los JSON de Tema, vuelve a ejecutar los Scripts_de_Ingesta contra las
# fuentes reales, pasa el Verificador y muestra el diff del lago. Si algún
# script o el Verificador falla, termina con código distinto de cero (3.9).
# Idealmente, dos ejecuciones el mismo día dan un lago idéntico (3.6, 3.7): si
# `git diff` muestra cambios inesperados, la ingesta no es reproducible.
set -euo pipefail

cd "$(dirname "$0")/.."

# El Python de python.org en macOS no trae la raíz de gdi.berlin.de en su
# almacén; si certifi está disponible y no se fijó SSL_CERT_FILE, se usa su
# bundle. Nunca se desactiva la verificación de certificados.
if [ -z "${SSL_CERT_FILE:-}" ]; then
  certifi_bundle="$(python3 -c 'import certifi; print(certifi.where())' 2>/dev/null || true)"
  if [ -n "$certifi_bundle" ] && [ -f "$certifi_bundle" ]; then
    export SSL_CERT_FILE="$certifi_bundle"
  fi
fi

echo "→ Borrando los JSON del lago…"
rm -f lago/*.json

for script in \
  ingesta/pull_territorio.py \
  ingesta/pull_poblacion.py \
  ingesta/pull_suelo.py \
  ingesta/pull_trafico.py; do
  echo "→ Ejecutando $script…"
  python3 "$script"
done

echo "→ Verificando el lago…"
python3 verificacion/verificar.py

echo "→ Cambios en el lago respecto a git:"
git diff --stat -- lago/
