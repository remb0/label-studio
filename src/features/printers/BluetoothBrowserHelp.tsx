import { useT } from "../../lib/i18n.ts";

export function BluetoothBrowserHelp() {
  const tx = useT();
  const isiOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const supported = "bluetooth" in navigator && window.isSecureContext;
  return (
    <article className="studio-card mt-5">
      <h2>{tx("Welke verbinding kan vanuit de browser?")}</h2>
      <p>
        {supported
          ? tx(
              "Je browser biedt Web Bluetooth. Verbinden kan met BLE-printers waarvoor Label Studio een printprotocol heeft.",
            )
          : isiOS
            ? tx(
                "Safari en Chrome op iPhone/iPad ondersteunen Web Bluetooth niet. Probeer Bluefy als BLE-browser. Werking verschilt per printer en is niet gegarandeerd.",
              )
            : tx(
                "Web Bluetooth voor BLE is hier niet beschikbaar. Probeer Chrome op Android, Windows of macOS, en open de site via HTTPS.",
              )}
      </p>
      <p>
        {tx(
          "Bluetooth Classic: in geschikte Chrome-versies via Web Serial met RFCOMM/SPP, na koppelen in het besturingssysteem. Dit is een andere verbinding dan BLE en is nog niet in Label Studio geïmplementeerd. Alleen ‘Bluetooth’ op de doos is dus geen bewijs van ondersteuning.",
        )}
      </p>
      <p>
        {tx(
          "Wifi / LAN: mogelijk met een geschikte HTTP(S)- of WebSocket-API, de juiste browser- en netwerktoestemming en een bekend printprotocol. Gewone websites kunnen geen willekeurige TCP-poort (zoals 9100) openen of automatisch alle LAN-printers opsporen. Printers zonder web-API hebben meestal een lokale printbridge nodig. Label Studio heeft die route nog niet.",
        )}
      </p>
      <p className="text-ui-xs">
        {tx("Browserdocumentatie: ")}
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
          {tx("Bluefy in de App Store")}
        </a>
      )}
    </article>
  );
}
