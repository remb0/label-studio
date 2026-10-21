#!/bin/zsh
cd "${0:A:h}" || exit 1
python3 - <<'PY'
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from subprocess import run

server = ThreadingHTTPServer(("127.0.0.1", 0), SimpleHTTPRequestHandler)
url = f"http://127.0.0.1:{server.server_port}/"
print(f"Fichero Labels is geopend op {url}")
print("Laat dit venster open tijdens het afdrukken. Druk op Ctrl+C om af te sluiten.")
run(["open", "-a", "Google Chrome", url], check=False)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
PY
