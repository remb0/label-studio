export const addressSteps = [
  "Bestand",
  "Kolommen",
  "Filters",
  "Controleren",
  "Ontwerp",
  "Afdrukken",
] as const;
export const addressStyleLabels = [
  "Vet",
  "Cursief",
  "Onderstrepen",
  "Rand",
] as const;
export type AddressField =
  | "company"
  | "name"
  | "street"
  | "number"
  | "postal"
  | "city"
  | "country"
  | "extra"
  | "type"
  | "active";
export const addressFields: {
  key: AddressField;
  label: string;
  aliases: string[];
}[] = [
  {
    key: "company",
    label: "Bedrijfsnaam",
    aliases: ["bedrijfsnaam", "bedrijf", "company"],
  },
  {
    key: "name",
    label: "Naam / contactpersoon",
    aliases: ["naam", "name", "contactpersoon", "full name"],
  },
  {
    key: "street",
    label: "Straat / volledig adres",
    aliases: ["straat", "street", "adres", "address"],
  },
  {
    key: "number",
    label: "Huisnummer",
    aliases: ["huisnummer", "number", "house number"],
  },
  {
    key: "postal",
    label: "Postcode",
    aliases: ["postcode", "postal", "zip", "postal code"],
  },
  { key: "city", label: "Plaats", aliases: ["stad", "plaats", "city", "town"] },
  { key: "country", label: "Land", aliases: ["land", "country"] },
  {
    key: "extra",
    label: "Extra regel",
    aliases: ["extra", "toevoeging", "address2"],
  },
  { key: "type", label: "Klanttype", aliases: ["klanttype", "type"] },
  { key: "active", label: "Actief (filter)", aliases: ["actief", "active"] },
];
export interface Address {
  company: string;
  name: string;
  street: string;
  postal: string;
  city: string;
  country: string;
  extra: string;
  type: string;
  sourceRow: number;
  selected: boolean;
}
export type Mapping = Partial<Record<AddressField, number[]>>;
export const emptyAddress = (): Address => ({
  company: "",
  name: "",
  street: "",
  postal: "",
  city: "",
  country: "",
  extra: "",
  type: "particulier",
  sourceRow: 1,
  selected: true,
});
export function parseCsv(
  text: string,
  delimiter = detectDelimiter(text),
): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closed = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted) {
        quoted = false;
        closed = true;
      } else if (!cell && !closed) quoted = true;
      else throw new Error("Onverwacht aanhalingsteken in de CSV.");
    } else if (c === delimiter && !quoted) {
      row.push(cell);
      cell = "";
      closed = false;
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
      closed = false;
    } else if (closed && !/\s/.test(c))
      throw new Error("Tekst na een afgesloten CSV-veld.");
    else if (!closed) cell += c;
  }
  if (quoted)
    throw new Error("De CSV bevat een niet afgesloten aanhalingsteken.");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  if (rows.length && rows.some((r) => r.length !== rows[0].length))
    throw new Error(
      "Niet alle rijen hebben hetzelfde aantal kolommen. Controleer het scheidingsteken.",
    );
  return rows;
}
export function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted) {
      if (c === "\n" || c === "\r") break;
      if (c in counts) counts[c]++;
    }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
export function suggestMapping(headers: string[]): Mapping {
  return Object.fromEntries(
    addressFields.map((f) => [
      f.key,
      headers
        .flatMap((h, i) =>
          f.aliases.includes(h.trim().toLowerCase()) ? [i] : [],
        )
        .slice(0, 1),
    ]),
  );
}
export function mapAddresses(
  rows: string[][],
  mapping: Mapping,
  options: {
    activeOnly: boolean;
    normalizePostal: boolean;
    defaultCountry: string;
    header: boolean;
  },
): Address[] {
  return rows.flatMap((row, index) => {
    const get = (key: AddressField) =>
      (mapping[key] || [])
        .map((i) => row[i] || "")
        .join(" ")
        .trim()
        .replace(/\s+/g, " ");
    if (
      options.activeOnly &&
      !["ja", "yes", "true", "1"].includes(get("active").toLowerCase())
    )
      return [];
    let postal = get("postal");
    if (options.normalizePostal && /^\d{4}\s*[a-z]{2}$/i.test(postal))
      postal = postal
        .replace(/\s/g, "")
        .toUpperCase()
        .replace(/^(\d{4})/, "$1 ");
    return [
      {
        company: get("company"),
        name: get("name"),
        street: [get("street"), get("number")].filter(Boolean).join(" "),
        postal,
        city: get("city"),
        country: get("country") || options.defaultCountry.trim(),
        extra: get("extra"),
        type:
          get("type").toLowerCase() ||
          (get("company") ? "zakelijk" : "particulier"),
        sourceRow: index + (options.header ? 2 : 1),
        selected: true,
      },
    ];
  });
}
export function validateAddress(a: Address): string[] {
  return [
    a.type === "zakelijk" && !a.company.trim() ? "Bedrijfsnaam ontbreekt" : "",
    !a.name.trim() && !a.company.trim() ? "Naam of bedrijf ontbreekt" : "",
    !a.street.trim() ? "Straat ontbreekt" : "",
    !a.postal.trim() ? "Postcode ontbreekt" : "",
    !a.city.trim() ? "Plaats ontbreekt" : "",
  ].filter(Boolean);
}
export function addressLines(a: Address): string[] {
  const business = a.type === "zakelijk" || Boolean(a.company.trim());
  return [
    a.company,
    a.name ? `${business ? "T.a.v. " : ""}${a.name}` : "",
    a.street,
    [a.postal, a.city].filter(Boolean).join(" "),
    a.extra,
    a.country,
  ].filter((v) => v.trim());
}
export interface MappingProfile {
  version: 1;
  name: string;
  headers: string[];
  mapping: Mapping;
}
export function parseMappingProfile(input: unknown): MappingProfile {
  if (!input || typeof input !== "object")
    throw new Error("Ongeldig mappingprofiel.");
  const p = input as MappingProfile;
  if (
    p.version !== 1 ||
    typeof p.name !== "string" ||
    !Array.isArray(p.headers) ||
    !p.headers.every((h) => typeof h === "string") ||
    !p.mapping ||
    typeof p.mapping !== "object" ||
    Object.entries(p.mapping).some(
      ([k, v]) =>
        !addressFields.some((f) => f.key === k) ||
        !Array.isArray(v) ||
        v.some((i) => !Number.isInteger(i) || i < 0 || i >= p.headers.length),
    )
  )
    throw new Error("Ongeldig of niet ondersteund mappingprofiel.");
  return { version: 1, name: p.name, headers: p.headers, mapping: p.mapping };
}
