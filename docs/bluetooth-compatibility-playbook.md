# Bluetooth compatibility playbook

Use this route when adding or improving support for another label printer. A catalog entry is not the same as a safe print implementation.

## 1. Identify the transport

1. Record the exact brand, model, hardware revision, firmware, advertised Bluetooth name and label dimensions.
2. Determine whether it uses BLE/GATT or Bluetooth Classic/RFCOMM. On BLE, inventory the services, characteristics, properties and negotiated MTU. On Classic, first verify that Web Serial over RFCOMM is available on the target Chrome/Edge platform.
3. Keep USB, BLE, Classic and wifi variants separate even when their retail names match.

## 2. Capture protocol evidence safely

1. Prefer manufacturer documentation or an open-source driver with a compatible license and a pinned commit.
2. Capture initialization, status, raster data, feed and shutdown messages from one known-good client. Do not send guessed commands to an unknown printer.
3. Document byte order, checksums, compression, row width, chunking, flow control, media mode, density and rotation.
4. Never publish device addresses, tokens, personal label content or raw identifiers from contributors.

## 3. Implement in layers

1. Add catalog facts and sources first, with `unknown` for facts that are not proven.
2. Add strict model/advertised-name matching. An unknown device must retain the previous profile and must not receive a fallback protocol.
3. Implement the protocol encoder as pure functions with golden byte fixtures.
4. Add the transport adapter separately, including service/characteristic fallback, negotiated chunk size, timeouts, disconnect handling and cancellation.
5. Add diagnostics that read capabilities where possible without printing.

## 4. Prove behavior

1. Unit-test raster conversion, command bytes, checksum, chunk boundaries, retries and cancellation.
2. Browser-test permission denial, unavailable Bluetooth, unknown devices, reconnect, disconnect during transfer and simultaneous-print prevention with a mock Bluetooth API.
3. Perform the physical checklist in `hardware-validation.md`: gap/continuous media, alignment, density, text, barcode/QR scan, image, multi-label batch, reconnect and power cycle.
4. Mark transfer and physical print separately. “Data sent” is not proof that a correct label left the printer.

## 5. Publish community evidence

1. Let an authenticated tester submit a result only for the exact connected catalog model.
2. Store coarse browser/OS information and the physical checklist; keep reports pending until moderation.
3. Show only approved aggregate counts publicly. Require multiple independent successful reports before calling a model community-verified.
4. Keep protocol changes in reviewed source-control changes with regression fixtures. Community reports never activate code automatically.

## Definition of done

- Sources and uncertainties are recorded.
- Unknown devices cannot receive commands.
- Automated unit and browser tests pass.
- At least one exact physical model completed the full checklist; broader “community verified” status requires the project’s chosen independent-report threshold.
- Rollback is possible by disabling the profile without affecting label design/export.
