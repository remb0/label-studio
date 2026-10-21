import { useLanguage } from "../../lib/i18n.ts";

export function BluetoothBrowserHelp() {
  const language = useLanguage((s) => s.language);
  const dutch = language === "nl";
  const isiOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const supported = "bluetooth" in navigator && window.isSecureContext;
  return (
    <article className="studio-card mt-5">
      <h2>
        {dutch
          ? "Bluetooth op telefoon en tablet"
          : "Bluetooth on phones and tablets"}
      </h2>
      <p>
        {supported
          ? dutch
            ? "Je browser biedt Web Bluetooth. Verbinden kan met BLE-printers waarvoor Label Studio een printprotocol heeft."
            : "Your browser offers Web Bluetooth. You can connect BLE printers for which Label Studio implements the printing protocol."
          : isiOS
            ? dutch
              ? "Safari en Chrome op iPhone/iPad ondersteunen Web Bluetooth niet. Probeer Bluefy als BLE-browser. Werking verschilt per printer en is niet gegarandeerd."
              : "Safari and Chrome on iPhone/iPad do not support Web Bluetooth. Try Bluefy as a BLE browser. Printer compatibility is not guaranteed."
            : dutch
              ? "Deze browser kan niet met Bluetooth-printers verbinden. Probeer Chrome op Android, Windows of macOS, en open de site via HTTPS."
              : "This browser cannot connect to Bluetooth printers. Try Chrome on Android, Windows or macOS using HTTPS."}
      </p>
      <p>
        {dutch
          ? "Bluetooth Classic, USB en wifi-printers hebben een eigen, nog te implementeren verbinding nodig."
          : "Bluetooth Classic, USB and Wi-Fi printers need their own integration."}
      </p>
      {isiOS && (
        <a
          href="https://apps.apple.com/nl/app/bluefy-web-ble-browser/id1492822055"
          target="_blank"
          rel="noopener noreferrer"
          className="studio-secondary inline-flex"
        >
          {dutch ? "Bluefy in de App Store" : "Bluefy in the App Store"}
        </a>
      )}
    </article>
  );
}
