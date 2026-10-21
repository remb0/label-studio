import { describe, expect, it } from "vitest";
import {
  STARTER_TEMPLATES,
  createStarterDocument,
} from "./starter-templates.ts";
import { validateSavedLabel } from "../lib/library.ts";

describe("built-in starter templates", () => {
  it.each(STARTER_TEMPLATES)(
    "$name is valid, printable and stays inside the label",
    (template) => {
      const document = createStarterDocument(template.id);
      expect(() => validateSavedLabel(document)).not.toThrow();
      expect(document.label.dpi).toBe(203);
      expect(document.settings?.rollDirection).toBe("vertical");
      expect(document.label.widthPx).toBeLessThanOrEqual(384);
      expect(document.elements.length).toBeGreaterThan(0);
      for (const element of document.elements) {
        expect(element.x).toBeGreaterThanOrEqual(0);
        expect(element.y).toBeGreaterThanOrEqual(0);
        expect(element.x + element.width).toBeLessThanOrEqual(
          document.label.widthPx,
        );
        expect(element.y + element.height).toBeLessThanOrEqual(
          document.label.heightPx,
        );
        if (document.label.shape === "circle") {
          const rx = document.label.widthPx / 2;
          const ry = document.label.heightPx / 2;
          for (const x of [element.x, element.x + element.width])
            for (const y of [element.y, element.y + element.height])
              expect(
                ((x - rx) / rx) ** 2 + ((y - ry) / ry) ** 2,
              ).toBeLessThanOrEqual(1);
        }
        if (element.type === "qrcode")
          expect(element.props.content).toBe("https://example.com");
      }
    },
  );

  it("creates independent documents with fresh IDs and preserves original templates", () => {
    const original = JSON.stringify(STARTER_TEMPLATES);
    const first = createStarterDocument("address");
    const second = createStarterDocument("address");
    expect(first.elements[0].id).not.toBe(second.elements[0].id);
    first.elements[0].props.text = "Mijn eigen tekst";
    first.label.widthMm = 10;
    expect(second.elements[0].props.text).toBe("Mila Voorbeeld");
    expect(JSON.stringify(STARTER_TEMPLATES)).toBe(original);
    expect(() => createStarterDocument("missing")).toThrow(
      "Onbekend startsjabloon",
    );
  });
});
