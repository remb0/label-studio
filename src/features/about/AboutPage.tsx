import { useT, useLanguage, t } from "../../lib/i18n.ts";

import { Github, Heart, ExternalLink } from "lucide-react";

const url = "https://github.com/remb0/label-studio";
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
            href={url + "/discussions"}
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
    </section>
  );
}
