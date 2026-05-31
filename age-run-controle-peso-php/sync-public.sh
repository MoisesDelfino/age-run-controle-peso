#!/bin/sh
set -eu

# Keep public assets/pages aligned with root files.
# This avoids stale UI when only one side is updated by deploy/custom actions.

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$ROOT_DIR"

mkdir -p public

FILES="
app.js
auth.js
bioimpedancia.html
bioimpedancia.js
bioimpedancia-scanner.js
apple-touch-icon.png
cadastro.html
effects.css
grupos-treino.html
grupos-treino.js
home.html
home.js
monitoramento.html
monitoramento.js
primeiro-acesso.html
primeiro-acesso.js
index.html
login.html
menu.js
pesagem.html
pesagem.js
ranking.html
ranking.js
recuperar-senha.html
recuperar-senha.js
manifest.json
pwa-icon.svg
icon-192.png
icon-512.png
sw.js
styles.css
theme.js
treinador.html
treinador.js
"

for file in $FILES; do
    if [ -f "$file" ]; then
        cp "$file" "public/$file"
    fi
done

echo "sync-public: arquivos sincronizados para public/."
