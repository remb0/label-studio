# Controle van printerafbeeldingen

Gecontroleerd op 22 oktober 2026. De catalogus bevat 20 modellen en 14 lokaal
gebundelde modelafbeeldingen. Logo's identificeren een merk, niet een apparaat.
De voormalige generieke silhouettes zijn geen modelgetrouwe productfoto's.

| Model                          | Afbeelding              | Controlebron                                                                  |
| ------------------------------ | ----------------------- | ----------------------------------------------------------------------------- |
| DYMO 550                       | Bevestigd               | Officiële DYMO-vergelijking, kolom 550                                        |
| DYMO 550 Turbo                 | Bevestigd               | Aparte kolom 550 Turbo, Turbo-opdruk / netwerksymbool                         |
| DYMO 5XL                       | Bevestigd               | Kolom 5XL, brede uitvoersleuf                                                 |
| DYMO 450 Twin Turbo            | Bevestigd               | Twee roluitgangen, aparte modelkolom                                          |
| DYMO 450 Duo                   | Bevestigd               | Hoge Duo-behuizing met tweede D1-tape-uitvoer                                 |
| Marklife P12                   | Productgalerij          | Exacte P12-productpagina; uitvoering/firmware kan afwijken                    |
| Marklife P15                   | Productgalerij          | Exacte P15-productpagina; uitvoering/kleur kan afwijken                       |
| Fichero D11s (Action)          | Verpakking / apparaat   | Action-artikel 3212141; modelkoppeling nu bevestigd door 0xMH/fichero-printer |
| NIIMBOT D110                   | Productafbeelding       | Product-JSON met titel D110 en afzonderlijke D110-afbeelding                  |
| NIIMBOT D11-H                  | Productafbeelding       | Afzonderlijke D11-H-afbeelding; niet de D11/D11s/D110                         |
| NIIMBOT B1                     | Productafbeelding       | B1-productpagina en product-JSON                                              |
| NIIMBOT B21                    | Productafbeelding       | B21-productpagina en product-JSON; afgebeelde kleur rood                      |
| Phomemo D30                    | Productafbeelding       | Officiële D30-productpagina en product-JSON                                   |
| Phomemo M110                   | Productafbeelding       | Officiële M110-productpagina en product-JSON                                  |
| DYMO 450                       | Nog geen foto gekoppeld | Geen exact bevestigd fabrikantasset gebundeld                                 |
| DYMO 450 Turbo                 | Nog geen foto gekoppeld | Geen foto van 450/550 hergebruikt                                             |
| DYMO 4XL                       | Nog geen foto gekoppeld | Geen 5XL-foto hergebruikt                                                     |
| LuckP D1S                      | Nog geen foto gekoppeld | Geen exacte uitvoeringsmatch; niet de AiYin/Fichero D11s                      |
| Marklife M60                   | Nog geen foto gekoppeld | X2-protocolalias bewijst geen identieke behuizing                             |
| Action pocket / onbekend model | Nog geen foto gekoppeld | Geen uniek artikelnummer voor de bestaande 300-dpi ontwerppreset              |

## Bronnen en werkwijze

- [DYMO modellenvergelijking](https://www.dymo.com/labelwriter.html): vijf
  afzonderlijke afbeeldingen gekoppeld via de exacte modelkolom.
- [Marklife P12](https://www.marklifeprinter.com/Mobile-Photo-Printer-Original-Portable-Printers-Impresora-Smart-Mini-Wireless-Thermal-Photo-Printer-p.html)
  en [P15](https://www.marklifeprinter.com/Marklife-Black-and-white-barcode-portable-bottle-mini-thermal-printing-sticker-printer-for-home-using-p.html):
  eigen productgalerijen, niet de gedeelde algemene marketingafbeeldingen.
- [Action 3212141](https://www.action.com/nl-nl/p/3212141/fichero-labelprinter/)
  plus [de modelreferentie uit GitHub](https://github.com/0xMH/fichero-printer/tree/f945a87c43240c0c8689d1cce53772f8a20073a3).
  Hiermee vervalt de eerdere onzekerheid over dit specifieke Action-artikel.
- [NIIMBOT-productleverancier](https://www.niimbotlabel.com/): modeltitel,
  product-JSON en specifieke afbeelding vergeleken. D11-H en D110 delen een
  uitgebreide verkooppagina maar krijgen uitdrukkelijk verschillende assets.
- [Phomemo D30](https://phomemo.com/products/d30-label-maker) en
  [M110](https://phomemo.com/products/m110-label-maker): officiële productpagina's.

De volledige bron- en asset-URL's, controledatum en eventuele aanvullende
modelreferentie staan in `src/features/printers/printer-images.ts`.
Afbeeldingen zijn visueel geïnspecteerd en worden zonder externe requests geladen.
Bij een ontbrekende afbeelding of laadfout verschijnt een neutraal pictogram
met uitleg, nooit een ander apparaat. Kleur, bundel en firmware kunnen afwijken.

Een foto bevestigt geen printprotocol. Vooral bij P12 zijn verschillende
firmware-/protocolvarianten onder dezelfde naam gerapporteerd. Zie ook de
[profielcontrole](printer-profiles.md) en `THIRD_PARTY_NOTICES.md`.
