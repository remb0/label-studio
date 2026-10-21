# Beveiliging en privacy

Meld kwetsbaarheden privé bij de repositoryeigenaar. Publiceer geen klantadressen, printeridentificatoren of toegangssleutels in issues.

De applicatie heeft geen backend voor adresgegevens. CSV-rijen worden in browsergeheugen verwerkt. Sjablonen kunnen persoonlijke tekst en afbeeldingen bevatten en worden lokaal bewaard; houd daar rekening mee op gedeelde apparaten.

HTTPS is vereist voor Web Bluetooth buiten localhost. De Dockerimage draait zonder root; de productiecontainer gebruikt een read-only filesystem en geen Docker-socket. De afzonderlijke deployment-runner heeft wel Docker-toegang en accepteert alleen de vertrouwde main-releaseworkflow.

Houd dependencies, de officiële GitHub-runner en basisimages bijgewerkt. De runner is bewust op een gecontroleerde versie geïnstalleerd; werk die bij wanneer GitHub een nieuwe versie vereist.
