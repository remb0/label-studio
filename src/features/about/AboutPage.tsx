import { useT, useLanguage, t } from "../../lib/i18n.ts";

import { Github, Heart, ExternalLink } from "lucide-react";

const url = "https://github.com/remb0/label-studio";
const credits = [
  {
    name: "Thermoprint",
    role: "Editorbasis en delen van de printerkern · MIT",
    href: "https://github.com/tomLadder/thermoprint/tree/51967b7bdf6ddfe6e64db6456fad86bf39276e9a",
  },
  {
    name: "fichero-printer",
    role: "Fichero/AiYin-model- en protocolonderzoek · MIT",
    href: "https://github.com/0xMH/fichero-printer/tree/f945a87c43240c0c8689d1cce53772f8a20073a3",
  },
  {
    name: "thermal-pocket-printer-basic",
    role: "Protocolonderzoek voor de eerdere LuckPrinter-implementatie",
    href: "https://github.com/ChiaraCannolee/thermal-pocket-printer-basic",
  },
  {
    name: "NiimBlue",
    role: "Modelregister en hardwaregegevens · MIT",
    href: "https://github.com/MultiMote/niimbluelib",
  },
  {
    name: "OpenTLP",
    role: "Hardwaretabel, primaire bronnen en onzekerheden · MIT",
    href: "https://github.com/opentlp/opentlp",
  },
  {
    name: "thermal-label",
    role: "Hardwaremetingen en protocolvergelijkingen",
    href: "https://thermal-label.github.io/",
  },
] as const;
export function AboutPage() {
  const tx = useT();
  const lang = useLanguage((s) => s.language);
  return (
    <section className="studio-page">
      <div className="studio-page-title">
        <span className="studio-eyebrow">{tx("OPEN SOURCE")}</span>
        <h1>{t(lang, "titleAbout")}</h1>
      </div>
      <div className="studio-cards">
        <article className="studio-card">
          <h2>{t(lang, "reason")}</h2>
          <p>{t(lang, "reasonBody")}</p>
        </article>
        <article className="studio-card">
          <h2>{t(lang, "author")}</h2>
          <p>{t(lang, "authorBody")}</p>
          <a
            className="studio-secondary inline-flex gap-2 items-center"
            href="https://github.com/remb0"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github size={16} /> @remb0 <ExternalLink size={12} />
          </a>
        </article>
        <article className="studio-card">
          <Heart size={26} />
          <h2>{t(lang, "donate")}</h2>
          <p>{t(lang, "donateBody")}</p>
          <a
            className="studio-primary inline-flex gap-2 items-center"
            href="https://github.com/sponsors/remb0"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t(lang, "donateLink")} <ExternalLink size={14} />
          </a>
        </article>
        <article className="studio-card">
          <Github size={26} />
          <h2>GitHub</h2>
          <p>
            {tx("MIT licensed · community driven · contributions welcome.")}
          </p>
          <a
            className="studio-secondary inline-flex gap-2 items-center"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t(lang, "github")} <ExternalLink size={14} />
          </a>
        </article>
      </div>
      <section className="studio-credits mt-8" aria-labelledby="credits-title">
        <div className="studio-page-title">
          <span className="studio-eyebrow">{tx("DANK AAN")}</span>
          <h2 id="credits-title">{tx("Credits & open-sourceprojecten")}</h2>
          <p>
            {tx(
              "Label Studio bouwt voort op werk van andere open-sourceprojecten. Vermelding betekent geen officiële samenwerking, goedkeuring of compatibiliteitsgarantie.",
            )}
          </p>
        </div>
        <div className="studio-cards">
          {credits.map((credit) => (
            <article className="studio-card" key={credit.name}>
              <h2>{credit.name}</h2>
              <p>{tx(credit.role)}</p>
              <a
                className="studio-secondary inline-flex gap-2 items-center"
                href={credit.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {tx("Bronproject")} <ExternalLink size={12} />
              </a>
            </article>
          ))}
        </div>
        <p className="studio-footnote">
          <a
            href={url + "/blob/main/THIRD_PARTY_NOTICES.md"}
            target="_blank"
            rel="noopener noreferrer"
          >
            {tx("Volledige licentie-, beeld- en handelsmerkvermeldingen")}
          </a>
        </p>
      </section>
    </section>
  );
}
