# Label Studio

[![CI](https://github.com/remb0/label-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/remb0/label-studio/actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-65d2f3)
![React + TypeScript](https://img.shields.io/badge/React-TypeScript-65d2f3)

Een labelstudio in je browser: visueel ontwerpen, enkele adreslabels maken en CSV-bestanden via een grafische wizard in bulk afdrukken. Adressen en afbeeldingen worden lokaal verwerkt.

Productieadres: **[labels.remb0.nl](https://labels.remb0.nl)**. Het adres is pas bruikbaar na het instellen van de reverse proxy en het HTTPS-certificaat.

![De visuele Label Studio-editor](docs/images/editor.png)

![Enkele adreslabels met fictieve voorbeeldgegevens](docs/images/address.png)

## Wat kun je ermee?

- Visuele editor op basis van Thermoprint: tekst, afbeeldingen, QR, barcodes, vormen, lagen, grid, linialen, zoom en undo/redo.
- Een aparte werkplek voor zakelijke en particuliere adreslabels, inclusief het BoxCare-logo of je eigen afbeelding.
- CSV-wizard met scheidingstekenherkenning, kolommapping, filters, bewerkbare validatie en labelvoorbeelden.
- Bulkqueue met proefdruk, pauze, annuleren en expliciete controle van onzekere afdrukken.
- Sjablonen en mappingprofielen lokaal bewaren en als JSON exporteren/importeren.
- Web Bluetooth en printerherkenning voor LuckP D1S, plus behouden Thermoprint-profielen.
- Uitgebreide labelinstellingen, vormmaskers, geprinte scheidingslijnen en lichte/donkere thema's. Een scheidingslijn verdeelt het ontwerp visueel; hij start geen afzonderlijke printjobs.
- Lokaal of in Docker draaien; geen database nodig.

## Snel lokaal starten

Gebruik Node.js 24 LTS of nieuwer (minimaal 22.12):

```sh
git clone https://github.com/remb0/label-studio.git
cd label-studio
npm ci
npm run dev
```

Open het lokale adres in Chrome of Edge. Op macOS kun je na `npm ci` ook `start.command` openen. Voor de oorspronkelijke adresapp zie [legacy/](legacy/).

## Docker

```sh
docker compose up -d --build
```

Standaard is de app alleen op `http://127.0.0.1:3022` bereikbaar. Gebruik voor de productiehost de LAN-bind en een vast commit-ID:

```sh
LABEL_STUDIO_BIND=192.168.0.13 COMMIT_SHA=<git-commit> docker compose up -d --build
```

Configureer Nginx Proxy Manager voor `labels.remb0.nl` → `http://192.168.0.13:3022`, met een geldig certificaat en HTTPS. Bluetooth werkt niet vanaf een gewoon HTTP-adres op het LAN. De container luistert op 8080 en draait zonder root, met een read-only filesystem en tijdelijke schrijfruimte in `/tmp`.

## Bluetooth en printerprofielen

Klik op **Verbinden** en selecteer de printer in de browserkiezer. De Bluetooth-adapter van je laptop of telefoon maakt verbinding; de Dockerhost heeft daarvoor geen Bluetooth nodig.

| Printerfamilie                             | Printkop                                                 | Status                                                                      |
| ------------------------------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| LuckP D1S / DP D1 / Fichero 3561           | 384 dots, 203 dpi, circa 48 mm printbaar op 52 mm papier | Legacyprotocol overgenomen en automatisch getest; fysieke validatie vereist |
| Marklife/Pristar-profielen uit Thermoprint | Profielafhankelijk                                       | Upstreamondersteuning behouden; niet op eigen hardware geverifieerd         |
| Fichero D11s met 96-dot-printkop           | Ander protocol/profiel                                   | Niet als 384-dot LuckP behandelen; geen gevalideerde ondersteuning claimen  |

De app bewaart printervoorkeuren per eerder toegestaan browserapparaat. De browser blijft beslissen over toestemming en opnieuw verbinden. Onbekende modellen worden niet met een willekeurig profiel aangestuurd.

Bij LuckP betekent een afgeronde opdracht **verzonden**. Controleer de fysieke afdruk: de printer geeft geen betrouwbare bevestiging voor ieder geprint label. Na verbindingsverlies wordt de laatste rij als onzeker behandeld; hervatten drukt die niet automatisch opnieuw af.

Safari en Firefox kunnen de editor gebruiken maar bieden geen normale Web Bluetooth-printroute. Gebruik Chrome of Edge op een apparaat met beschikbare Web Bluetooth-ondersteuning. HTTPS of localhost is verplicht.

## CSV-import

1. Kies **Bulklabels** en laad een CSV-bestand.
2. Controleer scheidingsteken en kopregel.
3. Koppel bronkolommen aan bedrijfsnaam, naam, straat, huisnummer, postcode en plaats. Bekijk direct voorbeeldwaarden.
4. Stel filters en standaardwaarden in; de BoxCare-export wordt automatisch voorgesteld.
5. Corrigeer ontbrekende adresgegevens en controleer de gegenereerde labels.
6. Print eerst een proeflabel en start daarna de geselecteerde batch.

Het CSV-bestand en de adressen worden niet naar de server gestuurd. Mappingprofielen bevatten de koppelingen en filters, niet de adresrijen. Exporteer zo'n profiel om het op een ander apparaat te gebruiken.

## Ontwikkelen en testen

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

De tests controleren onder andere CSV-parsing, mapping, adresvalidatie, labelgeometrie, imports, protocolbytes, servicefallback, chunking en verbindingsverlies. Browsertests controleren de editor, navigatie, mobiele viewport en CSV-flow. Mocktests bewijzen geen fysieke afdrukkwaliteit; gebruik de [hardwarechecklist](docs/hardware-validation.md).

## Releases en deployment

Een pull request draait lint, typecheck, tests, browserflows en een Docker-smoketest. De [releaseworkflow](.github/workflows/release.yml) publiceert na succesvolle CI op `main` een image met commit-tag naar GHCR. Automatisch bijwerken van de interne Dockerhost vereist een geconfigureerde deployment-runner; zie [deployment](docs/deployment.md). De app en `/version.json` tonen de gebouwde commit zodat een deployment controleerbaar is.

## Privacy

Geen analytics, externe fonts of adresuploads. Fonts en scripts worden in de build gebundeld. Templates en printervoorkeuren worden lokaal in browseropslag bewaard. Let op: templates kunnen zelf persoonlijke tekst of afbeeldingen bevatten. Wis of exporteer deze bewust op gedeelde computers.

## Roadmap

- Hardwarevalidatie met `LuckP_D1S_F828_BLE` voor gap en continuous.
- Aanvullende printerprofielen na fysieke validatie.
- Volledige Nederlandse vertaling van alle overgenomen editorpanelen.
- Optionele IndexedDB-opslag voor grotere bibliotheken en afbeeldingen.
- **TODO voor later:** ESPHome Bluetooth Proxy via een lokale print-gateway onderzoeken. Er is nu geen ESPHome-instelling of gateway geïmplementeerd.

## Credits en licentie

MIT, © 2026 Remco van Geel. De editor en delen van de printerkern zijn gebaseerd op [tomLadder/thermoprint](https://github.com/tomLadder/thermoprint), upstreamcommit `51967b7bdf6ddfe6e64db6456fad86bf39276e9a`, dat MIT als licentie vermeldt. Het bestaande LuckPrinter-protocol is geïnspireerd op [0xMH/fichero-printer](https://github.com/0xMH/fichero-printer) en [thermal-pocket-printer-basic](https://github.com/ChiaraCannolee/thermal-pocket-printer-basic).

Zie [LICENSE](LICENSE) en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
