/* Fichero/LuckP D1 label editor. Protocol based on public LuckPrinter research. */
const $ = (id) => document.getElementById(id);
const canvas = $('label');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const fields = ['company', 'name', 'street', 'postal', 'city', 'extra', 'imageScale', 'imageLayer', 'paperFormat', 'layout', 'fontSize', 'density', 'border'];
let picture = null;
let processedPicture = null;
let processedPictureWidth = 0;
let pictureCenter = { x: 0.5, y: 0.5 };
let pictureRect = null;
let dragOffset = null;
let textCenter = { x: 0.5, y: 0.5 };
let textRect = null;
let logicalWidth = 384;
let logicalHeight = 448;
let imported = [];
let activeIndex = -1;
const textStyle = { bold: true, italic: false, underline: false };
let device = null;
let writer = null;
let notifier = null;
let busy = false;
let notifications = [];

function setStatus(message) { $('status').textContent = message; }
function setConnection(message, connected) {
  $('connection').textContent = message;
  $('connection').classList.toggle('on', connected);
  for (const id of [...fields, 'csvFile', 'image', 'dragTarget', 'useLogo', 'useIcon', 'resetPosition', 'resetTextPosition', 'removeImage', 'bold', 'italic', 'underline']) $(id).disabled = busy;
  $('selectAll').disabled = busy || !imported.length;
  $('clearSelection').disabled = busy || !imported.length;
  $('print').disabled = !connected || busy;
  $('testPrint').disabled = !connected || busy;
  $('diagnose').disabled = !connected || busy;
  $('printBatch').disabled = !connected || busy || !imported.some(entry => entry.selected && !entry.errors.length);
  $('connect').textContent = connected ? 'Verbinding verbreken' : 'Verbind via Bluetooth';
}

function wrap(text, maxWidth, font, paint) {
  paint.font = font;
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (paint.measureText(test).width <= maxWidth || !line) line = test;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

function drawPicture(paint, width, height, isMain) {
  if (!picture) { if (isMain) pictureRect = null; return; }
  const w = Math.max(1, Math.round(Math.min(width * 0.5, 150) * Number($('imageScale').value) / 100));
  const h = Math.max(1, Math.round(w * picture.height / picture.width));
  const x = Math.round(pictureCenter.x * width - w / 2);
  const y = Math.round(pictureCenter.y * height - h / 2);
  if (isMain) pictureRect = { x, y, w, h };
  if (processedPicture && processedPictureWidth === w) {
    paint.drawImage(processedPicture, x, y);
    return;
  }
  const scratch = document.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  const s = scratch.getContext('2d', { willReadFrequently: true });
  s.fillStyle = '#fff';
  s.fillRect(0, 0, scratch.width, scratch.height);
  s.drawImage(picture, 0, 0, scratch.width, scratch.height);
  const pixels = s.getImageData(0, 0, scratch.width, scratch.height);
  // Error diffusion keeps photos and logos recognizable on a one-colour printer.
  for (let row = 0; row < scratch.height; row++) {
    for (let col = 0; col < scratch.width; col++) {
      const i = (row * scratch.width + col) * 4;
      const old = .2126 * pixels.data[i] + .7152 * pixels.data[i + 1] + .0722 * pixels.data[i + 2];
      const value = old < 150 ? 0 : 255;
      const error = old - value;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
      pixels.data[i + 3] = 255;
      for (const [dx, dy, factor] of [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]]) {
        const nx = col + dx, ny = row + dy;
        if (nx < 0 || nx >= scratch.width || ny >= scratch.height) continue;
        const j = (ny * scratch.width + nx) * 4;
        for (let channel = 0; channel < 3; channel++) pixels.data[j + channel] = Math.max(0, Math.min(255, pixels.data[j + channel] + error * factor));
      }
    }
  }
  s.putImageData(pixels, 0, 0);
  processedPicture = scratch;
  processedPictureWidth = w;
  paint.drawImage(scratch, x, y);
}

function editorAddress() {
  const entry = Object.fromEntries(['company', 'name', 'street', 'postal', 'city', 'extra'].map(id => [id, $(id).value]));
  entry.type = activeIndex >= 0 ? imported[activeIndex].type : (entry.company.trim() ? 'zakelijk' : 'particulier');
  return entry;
}
function renderLabel(targetCanvas, entry, isMain = false) {
  const labels30 = $('paperFormat').value === 'labels30';
  const width = 384;
  const height = labels30 ? 240 : 448;
  if (targetCanvas.width !== width || targetCanvas.height !== height) { targetCanvas.width = width; targetCanvas.height = height; }
  const paint = targetCanvas.getContext('2d', { willReadFrequently: isMain });
  const portrait = $('layout').value === 'portrait';
  const layoutWidth = portrait ? height : width;
  const layoutHeight = portrait ? width : height;
  if (isMain) {
    logicalWidth = layoutWidth;
    logicalHeight = layoutHeight;
    canvas.style.maxWidth = '560px';
    $('dimensions').textContent = `${labels30 ? '52 × 30 mm etiket' : '52 mm doorlopende rol · 56 mm ontwerp'} · ${portrait ? 'staand' : 'liggend'} · ${width} × ${height} afdrukpunten`;
    $('fontSizeValue').textContent = `${$('fontSize').value} px`;
  }
  paint.save();
  paint.setTransform(1, 0, 0, 1, 0, 0);
  if (portrait) { paint.translate(width, 0); paint.rotate(Math.PI / 2); }
  paint.fillStyle = '#fff';
  paint.fillRect(0, 0, layoutWidth, layoutHeight);
  const textWidth = layoutWidth - 24;
  const textX = Math.round(textCenter.x * layoutWidth - textWidth / 2);
  const pictureBehind = picture && $('imageLayer').value === 'back';
  if (pictureBehind) drawPicture(paint, layoutWidth, layoutHeight, isMain);
  const business = entry.type === 'zakelijk' || Boolean(entry.company.trim());
  const content = [
    business ? entry.company : '',
    entry.name.trim() ? `${business ? 'T.a.v. ' : ''}${entry.name.trim()}` : '',
    entry.street,
    [entry.postal, entry.city].filter(Boolean).join(' '),
    entry.extra,
  ].filter(value => value.trim());
  const size = Number($('fontSize').value);
  const font = `${textStyle.italic ? 'italic ' : ''}${textStyle.bold ? '700' : '400'} ${size}px Arial, sans-serif`;
  const lines = content.flatMap(value => wrap(value, textWidth, font, paint));
  const lineHeight = size + 7;
  let y = Math.round(textCenter.y * layoutHeight - lines.length * lineHeight / 2 + size);
  paint.font = font;
  const measuredWidths = lines.map(line => paint.measureText(line).width);
  const bounds = lines.length ? { x: textX, y: y - size, w: Math.max(...measuredWidths), h: lines.length * lineHeight } : null;
  if (isMain) textRect = bounds;
  for (const line of lines) {
    paint.font = font;
    if (pictureBehind) {
      paint.strokeStyle = '#fff';
      paint.lineWidth = 4;
      paint.lineJoin = 'round';
      paint.strokeText(line, textX, y);
    }
    paint.fillStyle = '#000';
    paint.fillText(line, textX, y);
    if (textStyle.underline) paint.fillRect(textX, y + 2, paint.measureText(line).width, Math.max(1, Math.round(size / 15)));
    y += lineHeight;
  }
  if (picture && !pictureBehind) drawPicture(paint, layoutWidth, layoutHeight, isMain);
  if ($('border').checked) { paint.lineWidth = 2; paint.strokeStyle = '#000'; paint.strokeRect(2, 2, layoutWidth - 4, layoutHeight - 4); }
  paint.restore();
  const outside = bounds && (bounds.x < 0 || bounds.x + bounds.w > layoutWidth || bounds.y < 0 || bounds.y + bounds.h > layoutHeight || measuredWidths.some(w => w > textWidth));
  if (isMain) $('warning').textContent = outside ? 'Tekst valt buiten het etiket. Verklein of verplaats het tekstblok.' : '';
  return outside;
}
function render() { return renderLabel(canvas, editorAddress(), true); }
for (const id of fields) $(id).addEventListener('input', () => { render(); scheduleSelectedPreviews(); });
function setPicture(source, label, objectUrl = null) {
  const image = new Image();
  image.onload = () => {
    picture = image;
    processedPicture = null;
    pictureCenter = { x: 0.5, y: 0.5 };
    $('imageScale').value = '100';
    $('scaleValue').textContent = '100%';
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    render();
    scheduleSelectedPreviews();
    setStatus(`${label} toegevoegd. Sleep het op het etiket en stel de grootte en laag in.`);
  };
  image.onerror = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setStatus(`${label} kon niet worden geladen.`);
  };
  image.src = source;
}
$('useLogo').addEventListener('click', () => setPicture('boxcare-logo.png', 'BoxCare-logo'));
$('useIcon').addEventListener('click', () => setPicture('boxcare-box.webp', 'BoxCare-icoon'));
$('image').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { setStatus('Kies een afbeelding zoals PNG of JPG.'); return; }
  const url = URL.createObjectURL(file);
  setPicture(url, 'Afbeelding', url);
});
$('imageScale').addEventListener('input', () => { $('scaleValue').textContent = `${$('imageScale').value}%`; });
$('resetPosition').addEventListener('click', () => { pictureCenter = { x: 0.5, y: 0.5 }; render(); scheduleSelectedPreviews(); });
$('resetTextPosition').addEventListener('click', () => { textCenter = { x: 0.5, y: 0.5 }; render(); scheduleSelectedPreviews(); });
$('removeImage').addEventListener('click', () => { picture = null; pictureRect = null; processedPicture = null; $('image').value = ''; render(); scheduleSelectedPreviews(); });
for (const style of ['bold', 'italic', 'underline']) {
  $(style).addEventListener('click', () => {
    textStyle[style] = !textStyle[style];
    $(style).classList.toggle('active', textStyle[style]);
    $(style).setAttribute('aria-pressed', String(textStyle[style]));
    render();
    scheduleSelectedPreviews();
  });
}
function canvasPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  const x = (event.clientX - bounds.left) * canvas.width / bounds.width;
  const y = (event.clientY - bounds.top) * canvas.height / bounds.height;
  return $('layout').value === 'portrait' ? { x: y, y: canvas.width - x } : { x, y };
}
canvas.addEventListener('pointerdown', (event) => {
  const point = canvasPoint(event);
  const target = $('dragTarget').value;
  if ((target === 'image' && !picture) || (target === 'text' && !textRect)) return;
  const center = target === 'image' ? pictureCenter : textCenter;
  dragOffset = { x: point.x - center.x * logicalWidth, y: point.y - center.y * logicalHeight, target };
  canvas.setPointerCapture(event.pointerId);
  canvas.style.cursor = 'grabbing';
  event.preventDefault();
});
canvas.addEventListener('pointermove', (event) => {
  if (dragOffset) {
    const point = canvasPoint(event);
    const center = dragOffset.target === 'image' ? pictureCenter : textCenter;
    center.x = Math.max(-0.25, Math.min(1.25, (point.x - dragOffset.x) / logicalWidth));
    center.y = Math.max(-0.25, Math.min(1.25, (point.y - dragOffset.y) / logicalHeight));
    render();
  } else canvas.style.cursor = 'grab';
});
function stopDragging() { if (dragOffset) scheduleSelectedPreviews(); dragOffset = null; canvas.style.cursor = 'grab'; }
canvas.addEventListener('pointerup', stopDragging);
canvas.addEventListener('pointercancel', stopDragging);

function setEditorAddress(entry) {
  for (const id of ['company', 'name', 'street', 'postal', 'city', 'extra']) $(id).value = entry?.[id] || '';
  $('previewName').textContent = entry ? `· CSV-rij ${entry.sourceRow}` : '';
  render();
}
let selectedPreviewTimer = null;
function scheduleSelectedPreviews() {
  clearTimeout(selectedPreviewTimer);
  selectedPreviewTimer = setTimeout(renderSelectedPreviews, 120);
}
function renderSelectedPreviews() {
  const gallery = $('selectedPreviews');
  gallery.replaceChildren();
  const chosen = imported.map((entry, index) => ({ entry, index })).filter(item => item.entry.selected && !item.entry.errors.length);
  $('previewCount').textContent = `(${chosen.length})`;
  if (!chosen.length) {
    const empty = document.createElement('p');
    empty.className = 'preview-empty';
    empty.textContent = 'Selecteer één of meer complete adressen in de CSV-lijst om alle etiketten hier te bekijken.';
    gallery.append(empty);
    return;
  }
  for (const { entry, index } of chosen) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `preview-card${index === activeIndex ? ' current' : ''}`;
    card.setAttribute('aria-label', `Bekijk etiket ${index + 1}: ${entry.type === 'zakelijk' ? entry.company : entry.name}`);
    const mini = document.createElement('canvas');
    renderLabel(mini, entry);
    const title = document.createElement('strong');
    title.textContent = entry.type === 'zakelijk' ? entry.company : entry.name;
    const subtitle = document.createElement('small');
    subtitle.textContent = `CSV-rij ${entry.sourceRow} · ${entry.postal} ${entry.city}`;
    card.append(mini, title, subtitle);
    card.addEventListener('click', () => { if (busy) return; activeIndex = index; setEditorAddress(entry); refreshImportView(); scheduleSelectedPreviews(); });
    gallery.append(card);
  }
}
function refreshImportView() {
  const list = $('addressList');
  list.replaceChildren();
  imported.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = `address-row${index === activeIndex ? ' selected' : ''}${entry.errors.length ? ' invalid' : ''}`;
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = entry.selected && !entry.errors.length;
    check.disabled = busy || !!entry.errors.length;
    check.setAttribute('aria-label', `Adres ${index + 1} selecteren`);
    check.addEventListener('click', event => event.stopPropagation());
    check.addEventListener('change', () => {
      entry.selected = check.checked;
      activeIndex = index;
      setEditorAddress(entry);
      refreshImportView();
      scheduleSelectedPreviews();
    });
    const main = document.createElement('div');
    main.className = 'address-main';
    const title = document.createElement('strong');
    title.textContent = `${index + 1}. ${entry.type === 'zakelijk' ? entry.company || '[Bedrijfsnaam ontbreekt]' : entry.name}`;
    const address = document.createElement('span');
    address.textContent = `${entry.type === 'zakelijk' ? `T.a.v. ${entry.name} · ` : ''}${entry.street} · ${entry.postal} ${entry.city}`;
    main.append(title, address);
    if (entry.errors.length) {
      const warning = document.createElement('small');
      warning.textContent = `${entry.errors.join('; ')} — vul dit bovenaan in om te kunnen printen.`;
      main.append(warning);
    }
    row.append(check, main);
    row.addEventListener('click', () => { if (busy) return; activeIndex = index; setEditorAddress(entry); refreshImportView(); scheduleSelectedPreviews(); });
    list.append(row);
  });
  refreshImportSummary();
}
function refreshImportSummary() {
  const valid = imported.filter(entry => !entry.errors.length).length;
  const chosen = imported.filter(entry => entry.selected && !entry.errors.length).length;
  $('importSummary').textContent = imported.length
    ? `${imported.length} actieve klanten · ${valid} complete adressen · ${chosen} geselecteerd.${valid < imported.length ? ' Open de gemarkeerde rij en vul ontbrekende gegevens aan.' : ''}`
    : 'De CSV wordt alleen in deze browser gelezen. Alleen rijen met Actief = Ja worden getoond.';
  $('selectAll').disabled = busy || !imported.length;
  $('clearSelection').disabled = busy || !imported.length;
  $('printBatch').disabled = !writer || busy || chosen === 0;
  $('printBatch').textContent = `Print geselecteerde adressen (${chosen})`;
}
function syncActiveFromFields() {
  if (activeIndex < 0) return;
  const entry = imported[activeIndex];
  for (const id of ['company', 'name', 'street', 'postal', 'city', 'extra']) entry[id] = $(id).value.trim();
  entry.errors = LabelCsv.validateAddress(entry);
  if (entry.errors.length) entry.selected = false;
  refreshImportView();
}
for (const id of ['company', 'name', 'street', 'postal', 'city', 'extra']) $(id).addEventListener('input', syncActiveFromFields);
$('csvFile').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const result = LabelCsv.importAddresses(await file.text());
    imported = result.addresses;
    activeIndex = imported.findIndex(entry => !entry.errors.length);
    setEditorAddress(imported[activeIndex]);
    refreshImportView();
    scheduleSelectedPreviews();
    setStatus(`${file.name}: ${imported.length} actieve klanten gevonden; ${result.inactive} niet-actieve rijen overgeslagen.${result.otherType ? ` ${result.otherType} rijen met onbekend klanttype overgeslagen.` : ''}`);
  } catch (error) {
    imported = [];
    activeIndex = -1;
    refreshImportView();
    scheduleSelectedPreviews();
    setStatus(`CSV-import mislukt: ${error.message}`);
  }
});
$('selectAll').addEventListener('click', () => { imported.forEach(entry => { entry.selected = !entry.errors.length; }); refreshImportView(); scheduleSelectedPreviews(); });
$('clearSelection').addEventListener('click', () => { imported.forEach(entry => { entry.selected = false; }); refreshImportView(); scheduleSelectedPreviews(); });
$('download').addEventListener('click', () => {
  render();
  const a = document.createElement('a');
  a.download = `adreslabel-52x${canvas.height === 240 ? '30' : '56'}mm.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
  setStatus(`PNG opgeslagen. De afbeelding heeft ${canvas.width} × ${canvas.height} pixels op 203 dpi.`);
});
$('systemPrint').addEventListener('click', () => {
  render();
  const windowForPrint = window.open('', '_blank');
  if (!windowForPrint) { setStatus('Sta pop-ups toe om de Mac-afdrukdialoog te openen.'); return; }
  const png = canvas.toDataURL('image/png');
  const physicalWidth = 52;
  const physicalHeight = canvas.height === 240 ? 30 : 56;
  const imageWidth = 48;
  windowForPrint.document.write(`<!doctype html><html><head><title>Adreslabel</title><style>@page{size:${physicalWidth}mm ${physicalHeight}mm;margin:0}html,body{margin:0;width:${physicalWidth}mm;height:${physicalHeight}mm}body{display:flex;align-items:center;justify-content:center}img{width:${imageWidth}mm;height:${physicalHeight}mm;image-rendering:pixelated}</style></head><body><img src="${png}" onload="setTimeout(() => window.print(), 200)"></body></html>`);
  windowForPrint.document.close();
});

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function write(bytes) {
  if (!writer) throw new Error('De Bluetooth-verbinding is verbroken.');
  const writeWithResponse = writer.properties.write;
  let chunkSize = 100;
  for (let offset = 0; offset < bytes.length;) {
    const chunk = bytes.slice(offset, offset + chunkSize);
    try {
      if (writeWithResponse) await writer.writeValueWithResponse(chunk);
      else { await writer.writeValueWithoutResponse(chunk); await delay(chunkSize === 100 ? 50 : 35); }
      offset += chunk.length;
    } catch (error) {
      if (chunkSize === 20) throw error;
      chunkSize = 20; // Some Bluetooth links do not negotiate a 100-byte write.
    }
  }
}
async function command(bytes, waitMs = 300) { await write(bytes); await delay(waitMs); }
function disconnect() {
  if (device?.gatt?.connected) device.gatt.disconnect();
  device = null;
  writer = null;
  notifier = null;
  notifications = [];
  setConnection('Niet verbonden', false);
}
$('connect').addEventListener('click', async () => {
  if (device?.gatt?.connected) { disconnect(); setStatus('Verbinding verbroken.'); return; }
  if (!navigator.bluetooth) { setStatus('Bluetooth is hier niet beschikbaar. Open start.command in Documenten/Fichero Labels; dat start de app in Google Chrome.'); return; }
  try {
    setStatus('Kies LuckP_D1S_F828_BLE in het Bluetooth-venster.');
    device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [0xff00, 0x18f0] });
    const name = device.name || '';
    if (!/^(fichero|dp[_-]?d1|luckp[_-]?d1)/i.test(name)) {
      disconnect();
      setStatus(`“${name || 'Onbekend apparaat'}” lijkt geen Fichero/LuckP D1-printer. Kies LuckP_D1S_F828_BLE.`);
      return;
    }
    device.addEventListener('gattserverdisconnected', () => { writer = null; notifier = null; setConnection('Niet verbonden', false); setStatus('Bluetooth-verbinding verbroken.'); });
    const server = await device.gatt.connect();
    for (const [serviceId, characteristicId, notifyId] of [[0xff00, 0xff02, 0xff01], [0x18f0, 0x2af1, 0x2af0]]) {
      try {
        const service = await server.getPrimaryService(serviceId);
        writer = await service.getCharacteristic(characteristicId);
        try {
          notifier = await service.getCharacteristic(notifyId);
          notifier.addEventListener('characteristicvaluechanged', (event) => {
            const value = event.target.value;
            notifications.push(Uint8Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)));
          });
          await notifier.startNotifications();
        } catch { notifier = null; }
        break;
      } catch { /* Try the other UART service used by LuckPrinter models. */ }
    }
    if (!writer) throw new Error('Geen geschikt Bluetooth-printkanaal (FF00 of 18F0) gevonden.');
    if (!writer.properties.write && !writer.properties.writeWithoutResponse) throw new Error('De printer heeft geen schrijfbaar Bluetooth-kanaal.');
    await delay(300);
    setConnection(name, true);
    setStatus('Verbonden. Maak eerst één proefetiket.');
  } catch (error) {
    disconnect();
    setStatus(error.name === 'NotFoundError' ? 'Geen printer gekozen.' : `Verbinden mislukt: ${error.message}`);
  }
});

function describeReply(bytes) {
  if (!bytes) return 'geen antwoord';
  const ascii = Array.from(bytes, n => n >= 32 && n <= 126 ? String.fromCharCode(n) : '').join('').trim();
  return ascii.length >= 2 ? ascii : Array.from(bytes, n => n.toString(16).padStart(2, '0')).join(' ');
}
async function queryPrinter(bytes) {
  notifications = [];
  await write(Uint8Array.from(bytes));
  await delay(600);
  return notifications.length ? notifications[notifications.length - 1] : null;
}
$('diagnose').addEventListener('click', async () => {
  if (!writer || busy) return;
  busy = true;
  setConnection(device?.name || 'Verbonden', true);
  const output = $('diagnosticResult');
  output.textContent = 'Printerinformatie wordt gelezen…';
  try {
    const lines = [
      `BLE-naam: ${device.name || 'onbekend'}`,
      `Notificaties: ${notifier ? 'ingeschakeld' : 'niet beschikbaar'}`,
      `Schrijfkanaal: ${writer.properties.write ? 'met ontvangstbevestiging' : 'zonder ontvangstbevestiging'}`,
    ];
    for (const [label, bytes] of [
      ['Model', [0x10, 0xff, 0x20, 0xf0]],
      ['Firmware', [0x10, 0xff, 0x20, 0xf1]],
      ['Batterij', [0x10, 0xff, 0x50, 0xf1]],
      ['Status', [0x10, 0xff, 0x40]],
    ]) {
      const reply = await queryPrinter(bytes);
      lines.push(`${label}: ${describeReply(reply)}`);
      output.textContent = lines.join('\n');
    }
    setStatus('Printerdiagnose klaar. Kopieer de regels hierboven als het testpatroon wit blijft.');
  } catch (error) {
    output.textContent += `\nFout: ${error.message}`;
    setStatus('Printerdiagnose mislukt.');
  } finally {
    busy = false;
    setConnection(device?.name || 'Niet verbonden', !!writer);
  }
});

function rasterBytes() {
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const bitmap = new Uint8Array(48 * canvas.height);
  const left = Math.floor((384 - canvas.width) / 2);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const p = (y * canvas.width + x) * 4;
      const printX = x + left;
      if ((pixels[p] + pixels[p + 1] + pixels[p + 2]) / 3 < 128) bitmap[y * 48 + (printX >> 3)] |= 0x80 >> (printX & 7);
    }
  }
  return bitmap;
}
function testBitmap() {
  const height = 240;
  const bitmap = new Uint8Array(48 * height);
  // At 203 dpi these 160-by-160 dots should print as a 20 mm square.
  for (let y = 40; y < 200; y++) {
    for (let x = 112; x < 272; x++) {
      if (y < 48 || y >= 192 || x < 120 || x >= 264 || Math.abs(x - 112 - (y - 40)) < 3) {
        bitmap[y * 48 + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }
  return { bitmap, height };
}
async function printJob(bitmap, height, isTest = false) {
  const blackBytes = bitmap.reduce((count, byte) => count + (byte !== 0), 0);
  if (!blackBytes) throw new Error('Het voorbeeld bevat geen zwarte afdrukpunten.');
  const labelMode = $('paperFormat').value === 'labels30';
  const raster = new Uint8Array(8 + bitmap.length);
  raster.set([0x1d, 0x76, 0x30, 0x00, 0x30, 0x00, height & 0xff, height >> 8]);
  raster.set(bitmap, 8);
  setStatus(`${isTest ? 'Testpatroon' : 'Etiket'} wordt verzonden (${blackBytes} bytes met zwarte punten)…`);
  await command(Uint8Array.of(0x10, 0xff, 0x10, 0x00, Number($('density').value)));
  await command(Uint8Array.of(0x10, 0xff, 0x84, labelMode ? 0x00 : 0x02));
  await command(Uint8Array.of(0x10, 0xff, 0xf1, 0x03));
  await command(new Uint8Array(12));
  if (labelMode) await command(Uint8Array.of(0x1f, 0x11, 0x51));
  await write(raster);
  await delay(500);
  if (labelMode) {
    await command(Uint8Array.of(0x1d, 0x0c));
    await command(Uint8Array.of(0x1f, 0x11, 0x50));
  } else await command(Uint8Array.of(0x1b, 0x4a, 0x50));
  await command(Uint8Array.of(0x10, 0xff, 0xf1, 0x45), 2000);
  setStatus(`${isTest ? 'Testpatroon' : 'Etiket'} via Bluetooth verstuurd. Controleer de afdruk; verzending bevestigt nog niet dat de printer de afbeelding heeft verwerkt.`);
}
async function runPrint(isTest) {
  if (!writer || busy) return;
  if (!isTest && !$('name').value.trim() && !$('street').value.trim()) { setStatus('Vul eerst ten minste een naam of straat in.'); return; }
  if (!isTest && activeIndex >= 0 && imported[activeIndex].errors.length) { setStatus(`Dit adres is onvolledig: ${imported[activeIndex].errors.join('; ')}.`); return; }
  busy = true;
  setConnection(device?.name || 'Verbonden', true);
  try {
    if (isTest) { const { bitmap, height } = testBitmap(); await printJob(bitmap, height, true); }
    else { render(); await printJob(rasterBytes(), canvas.height); }
  } catch (error) {
    setStatus(`Afdrukken mislukt: ${error.message}`);
  } finally {
    busy = false;
    setConnection(device?.name || 'Niet verbonden', !!writer);
    refreshImportSummary();
  }
}
$('print').addEventListener('click', () => runPrint(false));
$('testPrint').addEventListener('click', () => runPrint(true));
$('printBatch').addEventListener('click', async () => {
  if (!writer || busy) return;
  const queue = imported.map((entry, index) => ({ entry, index })).filter(item => item.entry.selected && !item.entry.errors.length);
  if (!queue.length) { setStatus('Selecteer eerst een of meer complete adressen.'); return; }
  const previous = activeIndex;
  let printed = 0;
  busy = true;
  setConnection(device?.name || 'Verbonden', true);
  try {
    for (const { entry, index } of queue) {
      activeIndex = index;
      setEditorAddress(entry);
      refreshImportView();
      setStatus(`Adres ${printed + 1} van ${queue.length} wordt geprint (CSV-rij ${entry.sourceRow})…`);
      await printJob(rasterBytes(), canvas.height);
      printed++;
    }
    setStatus(`${printed} geselecteerde adressen via Bluetooth verzonden. Controleer de afdrukken.`);
  } catch (error) {
    setStatus(`Printen gestopt na ${printed} van ${queue.length} adressen: ${error.message}. Controleer de laatste afdruk voor je opnieuw begint.`);
  } finally {
    activeIndex = previous;
    setEditorAddress(imported[activeIndex]);
    refreshImportView();
    busy = false;
    setConnection(device?.name || 'Niet verbonden', !!writer);
    refreshImportSummary();
  }
});
render();
setPicture('boxcare-logo.png', 'BoxCare-logo');
renderSelectedPreviews();
