import { describe, it, expect } from "vitest";
import {
  detectDelimiter,
  emptyAddress,
  mapAddresses,
  parseCsv,
  parseMappingProfile,
  suggestMapping,
  validateAddress,
} from "./address-model";
describe("CSV import", () => {
  it("reads BOM, escaped quotes, CRLF and multiline quoted values", () => {
    expect(
      parseCsv('\uFEFFNaam;Adres\r\n"A ""B""";"Regel 1\nRegel 2"'),
    ).toEqual([
      ["Naam", "Adres"],
      ['A "B"', "Regel 1\nRegel 2"],
    ]);
  });
  it("detects supported delimiters without counting delimiters inside quotes", () => {
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
    expect(detectDelimiter('"Name, person, company";Adres')).toBe(";");
  });
  it("rejects malformed CSV instead of silently shifting addresses", () => {
    expect(() => parseCsv('a;b\n"x;y')).toThrow("aanhalingsteken");
    expect(() => parseCsv("a;b\n1;2;3")).toThrow("kolommen");
    expect(() => parseCsv('a;b\n"x"oops;y')).toThrow();
  });
  it("maps BoxCare columns, preserves source row and filters inactive entries", () => {
    const rows = parseCsv(
      "Naam;Klanttype;Actief;Straat;Huisnummer;Postcode;Stad;Bedrijfsnaam\nRemco;zakelijk;Ja;Hoofdstraat;12;1234ab;Utrecht;BoxCare\nJan;particulier;Nee;Andere;1;9999ZZ;Amsterdam;",
    );
    const mapped = mapAddresses(rows.slice(1), suggestMapping(rows[0]), {
      activeOnly: true,
      normalizePostal: true,
      defaultCountry: "Nederland",
      header: true,
    });
    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toMatchObject({
      name: "Remco",
      street: "Hoofdstraat 12",
      postal: "1234 AB",
      company: "BoxCare",
      country: "Nederland",
      sourceRow: 2,
    });
    expect(validateAddress(mapped[0])).toEqual([]);
  });
  it("supports multiple source columns for a name", () => {
    const addresses = mapAddresses(
      [["Jan", "Jansen", "123"]],
      { name: [0, 1], number: [2] },
      {
        activeOnly: false,
        normalizePostal: false,
        defaultCountry: "",
        header: false,
      },
    );
    expect(addresses[0].name).toBe("Jan Jansen");
    expect(addresses[0].sourceRow).toBe(1);
  });
  it("validates required data and imported profile column indices", () => {
    expect(validateAddress(emptyAddress())).toHaveLength(4);
    expect(() =>
      parseMappingProfile({
        version: 1,
        name: "test",
        headers: ["Naam"],
        mapping: { name: [9] },
      }),
    ).toThrow();
    expect(() =>
      parseMappingProfile({
        version: 2,
        name: "test",
        headers: [],
        mapping: {},
      }),
    ).toThrow();
  });
});
