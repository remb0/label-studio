# Broncontrole van printerprofielen

Onderzoek: 22 oktober 2026. Catalogus uitgebreid van 14 naar 20 modellen, met
14 gekoppelde modelafbeeldingen. Dit is een gecontroleerde metadata-uitbreiding,
geen automatische import van externe printerdrivers.

## Scheiding tussen hardware, ontwerp en direct printen

- Hardwarefeiten staan in `printer-specs.ts`, met bronnen, controledatum en
  onderbouwing: productdocumentatie, communitybron, tegenstrijdig of onbekend.
- Ontwerppresets bepalen canvasmaten en export. Die waarden zijn geen bewijs van
  de fysieke printkop, het papier dat geladen is of browsercompatibiliteit.
- Alleen geregistreerde BLE-drivers kunnen verbinden. De zes nieuwe
  catalogusmodellen blijven alleen ontwerpen / PNG-export. Fichero D11s heeft
  nu een afzonderlijk AiYin-profiel voor `FICHERO_5836` en `D11s_`.
- Studio-certificering blijft leeg: geen van deze wijzigingen is een eigen
  fysieke proefafdruk. Externe claims blijven externe claims.

## Nieuwe catalogusmodellen

| Model         | Resolutie | Printkop volgens bron         | Direct printen in Label Studio |
| ------------- | --------- | ----------------------------- | ------------------------------ |
| NIIMBOT D110  | 203 dpi   | 96 dots, circa 12 mm          | Nee                            |
| NIIMBOT D11-H | 300 dpi   | 142 dots, circa 12 mm         | Nee                            |
| NIIMBOT B1    | 203 dpi   | 384 dots, circa 48 mm         | Nee                            |
| NIIMBOT B21   | 203 dpi   | 384 dots, circa 48 mm         | Nee                            |
| Phomemo D30   | 203 dpi   | 96 dots uit communitytabel    | Nee                            |
| Phomemo M110  | 203 dpi   | Betwist, bewust niet ingevuld | Nee                            |

Papier- en dichtheidsmodi van andere software worden niet blind als appoptie
geactiveerd. Zwarte-markering/transparent is bijvoorbeeld niet zomaar hetzelfde
als de huidige gap/continuous-instelling. Voor de nieuwe keuzes is `printWidth`
bewust 0: er is geen uitvoerbare driver aan gekoppeld.

## Belangrijkste correcties en onzekerheden

1. Fichero D11s is volgens 0xMH een AiYin-apparaat met een 96-dot-printkop,
   203 dpi, BLE en Classic SPP. De bron verwijst expliciet naar Action-artikel
   3212141; daarmee is de bijbehorende verpakking-/apparaatfoto nu onderbouwd.
   Het is niet de 384-dot LuckP D1S. USB-C-laden bewijst geen USB-printverbinding.
   De driver gebruikt daarom 12 rasterbytes per rij en de AiYin-specifieke
   enable/stopcommando's `10 FF FE 01` en `10 FF FE 45`; de Lujiang-commando's
   accepteert dit apparaat zonder afdruk.
2. DYMO 550 Turbo en 5XL hebben USB/Ethernet. Ethernet/LAN en wifi zijn nu aparte
   filters; LAN wordt niet langer als wifi gepresenteerd. DYMO Duo's tweede
   D1-tapemechanisme is niet hetzelfde als het LW-rolprofiel.
3. P12 wordt in bronnen met zowel L11 als moderne 1F-framing beschreven. Het
   bestaande L11-profiel is niet daardoor een universele P12-driver geworden.
   De gemeten 96-dot-printkop staat los van papierbreedte en oude softwaredefaults.
4. Voor P15 spreken bronnen over bevestigde versus afgeleide 96-dot-breedte.
   M60/X2 heeft eveneens afgeleide waarden. Onzekere printkopbreedtes blijven leeg.
5. Phomemo M110 wordt met zowel 344 als 384 dots beschreven. Fabrikantgegevens
   over 20–50 mm papier en 203 dpi lossen dat conflict niet op: papierbreedte is
   geen printkopbreedte. Daarom geen gegokte automatische instellingen/driver.
6. Het generieke Action-pocketprofiel heeft nog geen uniek artikelnummer. De
   300-dpi-waarde blijft alleen een bestaande ontwerppreset en telt niet mee als
   bevestigde 300-dpi-hardware in het zoekfilter.
7. De oude naam-prefixherkenning kon `M110` als `M1` herkennen. Zonder expliciet
   profielpatroon moet een modelprefix nu eindigen of door spatie, `_` of `-`
   worden gevolgd. Zo gaat geen Marklife-driver naar een andere modelreeks.

## Onderzochte GitHub-bronnen

- [NiimBlue modelregister](https://github.com/MultiMote/niimbluelib/blob/a9bc3f5c20c95e3a31ea3f5f2302ce7b27c34abe/src/printer_models.ts)
  (MIT): model-ID, DPI, printkop, richting en papierklassen; geen drivercode gekopieerd.
- [OpenTLP hardwaretabel](https://github.com/opentlp/opentlp/tree/b21036a918fd2cbf210e588b9456b60679ecc47e/packages/hardware/devices)
  (MIT): modelinformatie, primaire referenties en expliciete onzekerheden.
- [Fichero-printer](https://github.com/0xMH/fichero-printer/tree/f945a87c43240c0c8689d1cce53772f8a20073a3)
  (MIT): exacte Action-modelkoppeling en AiYin-protocolonderzoek.
- [Thermoprint](https://github.com/tomLadder/thermoprint): vergelijking met de
  bestaande P12/P15/M60-profielen, zonder nieuwe compatibiliteitsclaim.
- [thermal-label hardwareonderzoek](https://thermal-label.github.io/marklife/hardware):
  onderscheid tussen gemeten, afgeleide en niet-ondersteunde hardware.

Voor productbeelden en aanvullingen zijn de betreffende fabrikant- en
productleverancierspagina's geraadpleegd. Zie [afbeeldingencontrole](printer-images.md).
Licenties van referentiecode gelden niet automatisch voor productfoto's of logo's.

## Vervolg voor echte driverondersteuning

Nieuwe drivercode pas toevoegen na review van licentie en protocolvariant,
gescheiden raster-/framingtests, veilige detectie, browsertoestemmingen en een
fysieke proefafdruk op het exacte model/firmware. Geen aliassen blind kopiëren.
Bluetooth Classic en wifi blijven aparte nog niet ingebouwde transportlagen;
ESPHome blijft TODO voor later.

Het AiYin-profiel voor Fichero D11s is op de vastgezette MIT-bron gebaseerd en
automatisch getest. Een echte proefafdruk met `FICHERO_5836_BLE` blijft de
acceptatiecheck voor deze TypeScript/Web Bluetooth-implementatie.
