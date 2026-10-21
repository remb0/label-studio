/* Local-only CSV parsing and the BoxCare address-label mapping. */
(function (root) {
  function parseRows(text, delimiter) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        row.push(cell); cell = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some(value => value.trim())) rows.push(row);
        row = [];
      } else cell += char;
    }
    if (quoted) throw new Error('De CSV bevat een niet afgesloten aanhalingsteken.');
    row.push(cell);
    if (row.some(value => value.trim())) rows.push(row);
    return rows;
  }

  function importAddresses(text) {
    const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] || '';
    const delimiter = firstLine.includes(';') ? ';' : ',';
    const rows = parseRows(text, delimiter);
    if (!rows.length) throw new Error('De CSV is leeg.');
    const headers = rows.shift().map(value => value.trim());
    const required = ['Naam', 'Klanttype', 'Actief', 'Straat', 'Huisnummer', 'Postcode', 'Stad', 'Bedrijfsnaam'];
    const missing = required.filter(name => !headers.includes(name));
    if (missing.length) throw new Error(`Deze kolommen ontbreken: ${missing.join(', ')}.`);
    const positions = Object.fromEntries(required.map(name => [name, headers.indexOf(name)]));
    const addresses = [];
    let inactive = 0, otherType = 0;
    rows.forEach((row, index) => {
      const get = name => (row[positions[name]] || '').trim();
      if (get('Actief').toLowerCase() !== 'ja') { inactive++; return; }
      const type = get('Klanttype').toLowerCase();
      if (type !== 'particulier' && type !== 'zakelijk') { otherType++; return; }
      const entry = {
        sourceRow: index + 2,
        type,
        company: type === 'zakelijk' ? get('Bedrijfsnaam') : '',
        name: get('Naam'),
        street: [get('Straat'), get('Huisnummer')].filter(Boolean).join(' '),
        postal: get('Postcode'),
        city: get('Stad'),
        extra: '',
      };
      entry.errors = validateAddress(entry);
      entry.selected = entry.errors.length === 0;
      addresses.push(entry);
    });
    return { addresses, inactive, otherType };
  }

  function validateAddress(entry) {
    const errors = [];
    if (entry.type === 'zakelijk' && !entry.company.trim()) errors.push('Bedrijfsnaam ontbreekt');
    if (!entry.name.trim()) errors.push('Naam ontbreekt');
    if (!entry.street.trim()) errors.push('Straat en huisnummer ontbreken');
    if (!entry.postal.trim()) errors.push('Postcode ontbreekt');
    if (!entry.city.trim()) errors.push('Plaats ontbreekt');
    return errors;
  }

  const api = { importAddresses, validateAddress };
  root.LabelCsv = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
