# Beveiliging en privacy

Meld kwetsbaarheden privé bij de repositoryeigenaar. Publiceer geen klantadressen, printeridentificatoren of toegangssleutels in issues.

De applicatie stuurt geen adresbestanden of CSV-rijen naar de backend; deze blijven in het browsergeheugen. Sjablonen kunnen persoonlijke tekst en afbeeldingen bevatten en worden lokaal bewaard. Een aangemelde gebruiker kan bewust een snapshot van labels, sjablonen en voorkeuren naar de eigen MySQL-accountopslag sturen.

De browser heeft nooit MySQL-inloggegevens. De account-API gebruikt gehashte scrypt-wachtwoorden en opaque HttpOnly-sessiecookies; in MySQL wordt alleen een hash van het sessietoken bewaard. Houd databaseback-ups, SMTP-inloggegevens en de MySQL-poort privé. Communityrapporten zijn pas publiek zichtbaar nadat een beheerder ze heeft goedgekeurd.

HTTPS is vereist voor Web Bluetooth en beveiligde productie-sessiecookies buiten localhost. De frontend- en API-images draaien zonder root; de productiecontainers gebruiken waar mogelijk een read-only filesystem en geen Docker-socket. De afzonderlijke deployment-runner heeft wel Docker-toegang en accepteert alleen de vertrouwde main-releaseworkflow.

Houd dependencies, de officiële GitHub-runner en basisimages bijgewerkt. De runner is op een met checksum gecontroleerde versie geïnstalleerd en gebruikt daarna de officiële automatische updates.
