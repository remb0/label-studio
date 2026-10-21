# Hardwarevalidatie

Automatische tests vervangen geen printertest. Geef de eerste release pas hardwarestatus "geverifieerd" na deze controles met echte labels.

1. Selecteer `LuckP_D1S_F828_BLE` in Chrome; noteer firmware en herkend profiel.
2. Controleer 384 dots / 203 dpi en het onderscheid tussen 52 mm papier en circa 48 mm printbare breedte.
3. Print één 52×30 mm gap-label en controleer scherpte, richting en positionering.
4. Print één continuous-label met 56 mm ontwerp en controleer doorvoer.
5. Print logo, fijne tekst, QR en barcode; scan de laatste twee met een telefoon.
6. Print een batch van 25 labels; controleer volgorde, ontbrekende labels en duplicaten.
7. Pauzeer, hervat en annuleer een batch; een al verstuurde afdruk kan niet worden teruggenomen.
8. Verbreek de verbinding tijdens een label; de rij moet onzeker worden. Controleer fysiek voordat je opnieuw probeert.
9. Herstart de printer en verbind opnieuw met opgeslagen voorkeuren.
10. Test via `https://labels.remb0.nl` en via localhost.

Leg testdatum, browser/OS, firmware, papier en resultaat vast. Neem geen echte klantadressen op in screenshots of logs.
