import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  LANGUAGES,
  messages,
  t,
  formatNumber,
  formatDate,
  formatRelativeTime,
  message,
  LocalizedError,
  errorMessage,
  asMessage,
  messageList,
} from "./i18n.ts";
import { ALL_PRINTER_MODELS } from "../features/printers/model-catalog.ts";
import {
  BRANDS,
  CONNECTION_LABELS,
} from "../features/printers/printer-discovery.ts";
import { getPrinterSpecs } from "../features/printers/printer-specs.ts";
import { STARTER_TEMPLATES } from "../label/starter-templates.ts";
import { getFormatPresets } from "../label/format-presets.ts";
import {
  addressFields,
  addressSteps,
  addressStyleLabels,
  validateAddress,
  emptyAddress,
} from "../features/addresses/address-model.ts";
import { commands } from "../editor/palette/commands.ts";

afterEach(() => vi.unstubAllGlobals());
const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(directory, entry.name))
      : /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.")
        ? [join(directory, entry.name)]
        : [],
  );
}

describe("translation catalog", () => {
  it.each(LANGUAGES)(
    "%s has every key, nonempty text and identical placeholders",
    (language) => {
      expect(Object.keys(messages[language]).sort()).toEqual(
        Object.keys(messages.en).sort(),
      );
      for (const [key, text] of Object.entries(messages.en)) {
        expect(
          messages[language][key]?.trim(),
          `${language}: ${key}`,
        ).toBeTruthy();
        expect(
          placeholders(messages[language][key]),
          `${language}: ${key}`,
        ).toEqual(placeholders(text));
      }
    },
  );
  it("all statically referenced keys exist in every language", () => {
    const missing: string[] = [];
    for (const file of files("src")) {
      if (file.endsWith("i18n.ts")) continue;
      const source = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      function visit(node: ts.Node) {
        if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
          const name = node.expression.getText(source);
          const key = node.arguments?.[name === "t" ? 1 : 0];
          if (
            ["tx", "t", "translate", "message", "LocalizedError"].includes(
              name,
            ) &&
            key &&
            ts.isStringLiteral(key)
          ) {
            for (const language of LANGUAGES)
              if (!Object.hasOwn(messages[language], key.text))
                missing.push(`${file}: ${language}: ${key.text}`);
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    expect(missing).toEqual([]);
  });
  it("covers dynamic metadata without translating stored user content", () => {
    const keys = [
      ...addressSteps,
      ...addressStyleLabels,
      ...addressFields.map((f) => f.label),
      ...validateAddress(emptyAddress()),
      ...commands.flatMap((c) => [c.label, c.group]),
      ...BRANDS.map((b) => b.hint),
      ...Object.values(CONNECTION_LABELS).filter(
        (label) =>
          !["Bluetooth LE", "Bluetooth Classic", "Wifi", "USB"].includes(label),
      ),
      ...STARTER_TEMPLATES.flatMap((item) => [
        item.name,
        item.category === "Verzenden" ? "shippingCategory" : item.category,
        item.description,
      ]).filter((key) => !["QR-link", "Codes"].includes(key)),
      ...ALL_PRINTER_MODELS.flatMap((model) => {
        const specs = getPrinterSpecs(model.id);
        return [
          model.subtitle,
          ...specs.notes,
          ...specs.sources.map((s) => s.title),
          ...getFormatPresets(model.id).map((p) => p.name),
        ];
      }).filter((key) => !/^[\d\s×.]+mm$/.test(key)),
    ];
    expect(
      [...new Set(keys)].filter((key) => !Object.hasOwn(messages.en, key)),
    ).toEqual([]);
  });
  it("falls back to English and then to the key, and interpolates literally", () => {
    const previous = messages.de.draftRecoveryBody;
    try {
      delete messages.de.draftRecoveryBody;
      expect(
        t("de", "draftRecoveryBody", { name: "$& <test>", date: "date" }),
      ).toContain("$& <test>");
      expect(t("de", "draftRecoveryBody", { name: "N", date: "D" })).toEqual(
        t("en", "draftRecoveryBody", { name: "N", date: "D" }),
      );
      expect(t("es", "not-a-real-key")).toBe("not-a-real-key");
      expect(t("es", "__proto__")).toBe("__proto__");
      expect(t("fr", "toString")).toBe("toString");
      expect(t("invalid" as "nl", "editor")).toBe(messages.en.editor);
    } finally {
      messages.de.draftRecoveryBody = previous;
    }
  });
  it("retains nested error parameters for later language changes", () => {
    const error = errorMessage(
      new LocalizedError("rowError", {
        row: 1200,
        error: message("Bedrijfsnaam ontbreekt"),
      }),
    );
    expect(t("de", error)).toBe("Zeile 1.200: Firmenname fehlt");
    expect(t("en", error)).toBe("Row 1,200: Company name is missing");
    expect(
      t(
        "fr",
        messageList([
          asMessage("Straat ontbreekt"),
          asMessage("Plaats ontbreekt"),
        ]),
      ),
    ).toBe("Rue manquante, Ville manquante");
    expect(t("es", errorMessage(new Error("GATT diagnostic 42")))).toContain(
      "Detalles técnicos: GATT diagnostic 42",
    );
  });
});

describe("locale formatting and preference persistence", () => {
  it.each(LANGUAGES)(
    "formats numbers, dates and relative time using %s",
    (language) => {
      const locales = {
        nl: "nl-NL",
        en: "en-GB",
        de: "de-DE",
        fr: "fr-FR",
        es: "es-ES",
      };
      expect(formatNumber(language, 12345.6)).toBe(
        new Intl.NumberFormat(locales[language]).format(12345.6),
      );
      const date = new Date("2026-10-23T13:14:00Z");
      expect(
        formatDate(language, date, { dateStyle: "full", timeZone: "UTC" }),
      ).toBe(
        new Intl.DateTimeFormat(locales[language], {
          dateStyle: "full",
          timeZone: "UTC",
        }).format(date),
      );
      expect(
        formatRelativeTime(language, date.getTime() - 3600000, date.getTime()),
      ).toBe(
        new Intl.RelativeTimeFormat(locales[language], {
          numeric: "auto",
        }).format(-1, "hour"),
      );
    },
  );
  it.each([
    ["fr", "de-DE", "fr"],
    [null, "de-DE", "de"],
    ["invalid", "es-ES", "es"],
    [null, "ja-JP", "en"],
  ])(
    "initial preference %s / browser %s resolves to %s",
    async (stored, browser, expected) => {
      vi.resetModules();
      vi.stubGlobal("localStorage", { getItem: () => stored });
      vi.stubGlobal("navigator", { language: browser });
      const { useLanguage } = await import("./i18n.ts");
      expect(useLanguage.getState().language).toBe(expected);
    },
  );
  it("language changes update the document and storage while preserving unrelated preferences", async () => {
    vi.resetModules();
    const storage = new Map([
      ["label-studio:lang", "nl"],
      ["tp.theme", "forest"],
      ["tp.model", "p12"],
    ]);
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => storage.get(k),
      setItem: (k: string, v: string) => storage.set(k, v),
    });
    vi.stubGlobal("document", { documentElement: { lang: "nl" } });
    const { useLanguage } = await import("./i18n.ts");
    useLanguage.getState().setLanguage("fr");
    expect(document.documentElement.lang).toBe("fr");
    expect(storage.get("label-studio:lang")).toBe("fr");
    expect(storage.get("tp.theme")).toBe("forest");
    expect(storage.get("tp.model")).toBe("p12");
    useLanguage.getState().setLanguage("invalid" as "nl");
    expect(useLanguage.getState().language).toBe("en");
  });
  it("works when browser storage is blocked", async () => {
    vi.resetModules();
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw Error("blocked");
      },
      setItem: () => {
        throw Error("blocked");
      },
    });
    vi.stubGlobal("navigator", { language: "es-ES" });
    vi.stubGlobal("document", { documentElement: { lang: "" } });
    const { useLanguage } = await import("./i18n.ts");
    expect(useLanguage.getState().language).toBe("es");
    expect(() => useLanguage.getState().setLanguage("de")).not.toThrow();
    expect(useLanguage.getState().language).toBe("de");
  });
});

it("keeps new visible JSX text and accessibility labels in the translation layer", () => {
  // Product names, standards, units, axis symbols and keyboard notation are language-neutral.
  const neutral = new Set([
    "mm",
    "px",
    "px · (",
    "mm ·",
    "x",
    "el",
    "⌘K",
    "⌘P",
    "X",
    "Y",
    "W",
    "H",
    "Rot",
    "CTR",
    "ECC",
    "ESC",
    "ID",
    "MAC",
    "Firmware",
    "Barcode",
    "QR",
    "zoom",
    "Logo",
    "Tab",
    "Label Studio",
    "LABEL",
    "STUDIO",
    "· commit",
    "@remb0",
    "GitHub",
    "203 dpi",
    "300 dpi",
    "Web Bluetooth",
    "BLE · 2.4GHz",
    "Web Serial / Bluetooth Classic",
    "Chrome Android",
    "Local Network Access",
  ]);
  const remaining: string[] = [];
  for (const file of files("src").filter((file) => file.endsWith(".tsx"))) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    function visit(node: ts.Node) {
      let text: string | undefined;
      if (ts.isJsxText(node)) text = node.text.replace(/\s+/g, " ").trim();
      if (
        ts.isJsxAttribute(node) &&
        ["title", "label", "aria-label", "placeholder", "alt"].includes(
          node.name.getText(source),
        ) &&
        node.initializer &&
        ts.isStringLiteral(node.initializer)
      )
        text = node.initializer.text;
      if (
        text &&
        /\p{L}/u.test(text) &&
        !neutral.has(text) &&
        !/^&\w+;$/.test(text)
      )
        remaining.push(`${file}: ${text}`);
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  expect(remaining).toEqual([]);
});
