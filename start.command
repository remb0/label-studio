#!/bin/zsh
cd "${0:A:h}" || exit 1
if ! command -v npm >/dev/null; then
  print 'Installeer Node.js 24 LTS om Label Studio lokaal te starten.'
  read '?Druk op Enter om af te sluiten.'
  exit 1
fi
if [[ ! -d node_modules ]]; then
  print 'Voer eerst npm ci uit in deze projectmap.'
  read '?Druk op Enter om af te sluiten.'
  exit 1
fi
print 'Label Studio start op http://127.0.0.1:5173. Laat dit venster open.'
BROWSER="Google Chrome" npm run dev -- --port 5173 --strictPort --open
