# Controle van printerafbeeldingen

Gecontroleerd op 22 oktober 2026. Merklogo's identificeren uitsluitend een merk;
ze stellen geen printermodel voor. De oude generieke silhouettes waren geen
modelgetrouwe afbeeldingen en worden niet meer als modelafbeelding gebruikt.

De wizard toont tekst **naast** het logo of de productfoto, ook op mobiel.
Alleen expliciet gekoppelde productfoto's worden getoond. Geen afleiding uit
modelnaam, familie, alias, DPI of een gelijkende behuizing. Bij een ontbrekende
of niet bevestigde afbeelding staat een neutraal pictogram met een tekstmelding.
Een laadfout gebruikt dezelfde veilige terugval, nooit een foto van een ander model.

| Model                                        | Uitkomst                | Bron / reden                                                                                                                                                                                                                       |
| -------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DYMO LabelWriter 550                         | Productfoto bevestigd   | [Fabrikantvergelijking](https://www.dymo.com/labelwriter.html), kolom 550; één rol, front met drie knoppen                                                                                                                         |
| DYMO LabelWriter 550 Turbo                   | Productfoto bevestigd   | Zelfde fabrikantvergelijking, aparte kolom 550 Turbo; Turbo-opdruk en netwerksymbool                                                                                                                                               |
| DYMO LabelWriter 5XL                         | Productfoto bevestigd   | Zelfde fabrikantvergelijking, kolom 5XL; brede uitvoersleuf en XL-behuizing                                                                                                                                                        |
| DYMO LabelWriter 450 Twin Turbo              | Productfoto bevestigd   | Zelfde fabrikantvergelijking, kolom Twin Turbo; twee roluitgangen en twee blauwe knoppen                                                                                                                                           |
| DYMO LabelWriter 450 Duo                     | Productfoto bevestigd   | Zelfde fabrikantvergelijking, kolom Duo; hoge behuizing met tweede uitvoer voor D1-tape                                                                                                                                            |
| Marklife P12                                 | Fabrikantfoto bevestigd | [P12-productpagina](https://www.marklifeprinter.com/Mobile-Photo-Printer-Original-Portable-Printers-Impresora-Smart-Mini-Wireless-Thermal-Photo-Printer-p.html), eerste productgalerijfoto; afgebeelde kleurvariant kan afwijken   |
| Marklife P15                                 | Fabrikantfoto bevestigd | [P15-productpagina](https://www.marklifeprinter.com/Marklife-Black-and-white-barcode-portable-bottle-mini-thermal-printing-sticker-printer-for-home-using-p.html), eerste productgalerijfoto; afgebeelde kleurvariant kan afwijken |
| DYMO LabelWriter 450                         | Geen foto gekoppeld     | Geen exact bevestigd fabrikantasset opgenomen; geen Turbo-foto hergebruikt                                                                                                                                                         |
| DYMO LabelWriter 450 Turbo                   | Geen foto gekoppeld     | Geen exact bevestigd fabrikantasset opgenomen; geen 450- of 550-foto hergebruikt                                                                                                                                                   |
| DYMO LabelWriter 4XL                         | Geen foto gekoppeld     | Geen exact bevestigd fabrikantasset opgenomen; niet hetzelfde als 5XL                                                                                                                                                              |
| LuckP D1S                                    | Geen foto gekoppeld     | Geen exacte model-/uitvoeringsmatch bevestigd; geen algemene Fichero-foto                                                                                                                                                          |
| Marklife M60                                 | Geen foto gekoppeld     | X2 is een protocol-/zoekalias, geen bewijs van dezelfde behuizing                                                                                                                                                                  |
| Fichero D11s (Action)                        | Geen foto gekoppeld     | [Action-artikel 3212141](https://www.action.com/nl-nl/p/3212141/fichero-labelprinter/) vermeldt niet expliciet D11s; daarom geen zekere modelmatch                                                                                 |
| Action mini thermal pocket printer (300 dpi) | Geen foto gekoppeld     | Catalogusnaam is niet voldoende om een uniek Action-artikel vast te stellen                                                                                                                                                        |

De twee Marklife-pagina's delen ook algemene marketingafbeeldingen. Daarom worden
die niet gebruikt: de koppelingen wijzen naar hun afzonderlijke productgalerij.
Een foto van P12 bewijst niet hoe elke P11/LP90-variant eruitziet.

Technische bron- en asset-URL's en controledatum staan per model in
`src/features/printers/printer-images.ts`. De wizard linkt bij de controle-stap
naar de bron. Foto's worden lokaal gebundeld, zonder externe requests tijdens
gebruik. De rechten blijven bij de betreffende fabrikant; zie
`THIRD_PARTY_NOTICES.md`. Bevestiging van de foto is geen bevestiging van fysieke
printcompatibiliteit. Printerinstellingen en BLE-protocollen zijn niet gewijzigd.
