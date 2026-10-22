/** Catalog/design presets, not executable printer drivers. Sources: printer-specs.ts. */
interface ResearchModel {
  id: string;
  name: string;
  subtitle: string;
  silhouette: "compact" | "slim" | "wide";
  dpi: 203 | 300;
  paperTypes: ("gap" | "continuous")[];
  sizes: { widthMm: number; heightMm: number }[];
}

export const RESEARCHED_MODELS: ResearchModel[] = [
  {
    id: "niimbot-d110",
    name: "NIIMBOT D110",
    subtitle: "203 dpi · catalogus / alleen ontwerpen",
    silhouette: "slim",
    dpi: 203,
    paperTypes: ["gap"],
    sizes: [
      { widthMm: 30, heightMm: 15 },
      { widthMm: 40, heightMm: 12 },
    ],
  },
  {
    id: "niimbot-d11-h",
    name: "NIIMBOT D11-H",
    subtitle: "300 dpi · niet de D11 of D11s",
    silhouette: "slim",
    dpi: 300,
    paperTypes: ["gap"],
    sizes: [
      { widthMm: 30, heightMm: 15 },
      { widthMm: 40, heightMm: 12 },
    ],
  },
  {
    id: "niimbot-b1",
    name: "NIIMBOT B1",
    subtitle: "203 dpi · catalogus / alleen ontwerpen",
    silhouette: "wide",
    dpi: 203,
    paperTypes: ["gap"],
    sizes: [
      { widthMm: 50, heightMm: 30 },
      { widthMm: 40, heightMm: 30 },
    ],
  },
  {
    id: "niimbot-b21",
    name: "NIIMBOT B21",
    subtitle: "203 dpi · catalogus / alleen ontwerpen",
    silhouette: "wide",
    dpi: 203,
    paperTypes: ["gap", "continuous"],
    sizes: [
      { widthMm: 50, heightMm: 30 },
      { widthMm: 40, heightMm: 30 },
    ],
  },
  {
    id: "phomemo-d30",
    name: "Phomemo D30",
    subtitle: "203 dpi · catalogus / alleen ontwerpen",
    silhouette: "slim",
    dpi: 203,
    paperTypes: ["gap"],
    sizes: [
      { widthMm: 40, heightMm: 12 },
      { widthMm: 30, heightMm: 14 },
      { widthMm: 30, heightMm: 15 },
    ],
  },
  {
    id: "phomemo-m110",
    name: "Phomemo M110",
    subtitle: "20–50 mm papier · printkopbreedte betwist",
    silhouette: "wide",
    dpi: 203,
    paperTypes: ["gap", "continuous"],
    sizes: [
      { widthMm: 40, heightMm: 30 },
      { widthMm: 50, heightMm: 30 },
    ],
  },
];
