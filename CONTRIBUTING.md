# Bijdragen

Gebruik Node.js 24 en `npm ci`. Werk in een featurebranch en open een pull request naar `main`.

Voer voor een pull request `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` en `npm run test:e2e` uit. Wijzigingen aan protocolbytes, CSV-mapping of rastergeometrie krijgen gerichte regressietests. Gebruik alleen fictieve adressen in tests en screenshots.

De deployment-runner heeft Docker-toegang. Laat nieuwe workflowcode zorgvuldig beoordelen en voer daar geen pull-requestcode uit. Vermeld in een PR afzonderlijk wat automatisch is getest en wat op echte printerhardware is gecontroleerd.

Thermoprint-code staat met bronvermelding in THIRD_PARTY_NOTICES.md. Behoud de licentie en attributie bij wijzigingen of synchronisatie.
