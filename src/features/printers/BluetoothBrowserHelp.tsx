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
          ? "Welke verbinding kan vanuit de browser?"
          : "Which connections can work from a browser?"}
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
          ? "Bluetooth Classic: in geschikte Chrome-versies via Web Serial met RFCOMM/SPP, na koppelen in het besturingssysteem. Dit is een andere verbinding dan BLE en is nog niet in Label Studio geïmplementeerd. Alleen ‘Bluetooth’ op de doos is dus geen bewijs van ondersteuning."
          : "Bluetooth Classic can use Web Serial over RFCOMM/SPP in supported Chrome versions, after OS pairing. This is different from BLE and is not implemented in Label Studio. A Bluetooth logo alone does not prove compatibility."}
      </p>
      <p>
        {dutch
          ? "Wifi / LAN: mogelijk met een geschikte HTTP(S)- of WebSocket-API, de juiste browser- en netwerktoestemming en een bekend printprotocol. Gewone websites kunnen geen willekeurige TCP-poort (zoals 9100) openen of automatisch alle LAN-printers opsporen. Printers zonder web-API hebben meestal een lokale printbridge nodig. Label Studio heeft die route nog niet."
          : "Wi-Fi / LAN can work with a suitable HTTP(S) or WebSocket API, browser/network permission and a known print protocol. Ordinary websites cannot open arbitrary TCP ports (such as 9100) or discover every LAN printer. A local print bridge is usually needed without a web API; Label Studio does not implement that route yet."}
      </p>
      <p className="text-ui-xs">
        {dutch ? "Browserdocumentatie: " : "Browser documentation: "}
        <a
          href="https://developer.chrome.com/blog/serial-over-bluetooth"
          target="_blank"
          rel="noopener noreferrer"
        >
          Web Serial / Bluetooth Classic
        </a>
        {" · "}
        <a
          href="https://developer.chrome.com/release-notes/138#web_serial_over_bluetooth_on_android"
          target="_blank"
          rel="noopener noreferrer"
        >
          Chrome Android
        </a>
        {" · "}
        <a
          href="https://developer.chrome.com/blog/local-network-access"
          target="_blank"
          rel="noopener noreferrer"
        >
          Local Network Access
        </a>
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
