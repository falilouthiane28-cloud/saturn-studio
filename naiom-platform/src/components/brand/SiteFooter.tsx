import Link from "next/link";
import { AgentAvatar } from "@/components/AgentAvatar";
import { Icon } from "@/components/Icon";
import { SaturnLogo } from "@/components/brand/SaturnLogo";

const CONTACT_EMAIL = "contact@saturnstudio.com";

const STUDIO_LINKS = [
  { href: "/dashboard", label: "Studio" },
  { href: "/live", label: "Coulisses" },
  { href: "/calendrier", label: "Calendrier" },
  { href: "/settings", label: "Connexions" },
];

type FooterAgent = { slug: string; name: string; role: string };

/**
 * Pied de page unique du site.
 * - `full` (landing) : appel à l'action de clôture, plan du site, équipe.
 * - `compact` (pages de l'app) : une ligne, mêmes liens, même signature.
 * Aucun lien factice : seules des destinations réelles sont listées.
 */
export function SiteFooter({
  variant = "compact",
  agents = [],
}: {
  variant?: "full" | "compact";
  agents?: FooterAgent[];
}) {
  const year = new Date().getFullYear();

  if (variant === "compact") {
    return (
      <footer className="ds-footer ds-footer--compact">
        <div className="ds-footer__wrap ds-footer__row">
          <Link href="/" className="ds-footer__brand" aria-label="Saturn Studio, retour à l'accueil">
            <SaturnLogo variant="full" size={17} />
          </Link>
          <nav aria-label="Pied de page" className="ds-footer__inline">
            {STUDIO_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="ds-footer__link">
                {l.label}
              </Link>
            ))}
          </nav>
          <span className="ds-footer__legal">© {year} Saturn Studio · Fallou Thiane</span>
        </div>
      </footer>
    );
  }

  return (
    <footer id="contact" className="ds-footer ds-footer--full">
      <div className="ds-footer__wrap">
        {/* Clôture : une seule action principale, une secondaire. */}
        <section className="ds-footer__cta" aria-labelledby="footer-cta-title" data-reveal>
          <div className="ds-footer__cta-copy">
            <p className="ds-footer__eyebrow">
              <span className="ds-footer__live" aria-hidden />
              {agents.length} employés IA en ligne
            </p>
            <h2 id="footer-cta-title" className="ds-footer__title">
              Votre équipe IA, <em>au travail dès cette semaine.</em>
            </h2>
            <p className="ds-footer__lede">
              Un call de 30 minutes pour cartographier vos process. On repart avec la liste
              des agents à déployer et le chiffrage.
            </p>
            <div className="ds-footer__actions">
              <a href={`mailto:${CONTACT_EMAIL}?subject=Réserver%20un%20call`} className="ds-footer__btn ds-footer__btn--primary">
                Réserver un call
                <Icon name="ArrowRight" size={16} aria-hidden />
              </a>
              <Link href="/dashboard" className="ds-footer__btn ds-footer__btn--ghost">
                Entrer dans le studio
              </Link>
            </div>
          </div>
          {agents.length > 0 && (
            <ul className="ds-footer__crew" aria-label="L'équipe">
              {agents.map((a) => (
                <li key={a.slug}>
                  <Link href={`/agents/${a.slug}`} className="ds-footer__crew-item" title={`${a.name} · ${a.role}`}>
                    <AgentAvatar slug={a.slug} size={56} name={a.name} />
                    <span className="ds-footer__crew-name">{a.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Plan du site */}
        <div className="ds-footer__grid">
          <div className="ds-footer__about">
            <SaturnLogo variant="full" size={20} />
            <p>
              Agence d&apos;ingénierie d&apos;agents IA et d&apos;automatisations n8n, connectés à vos
              vrais outils.
            </p>
          </div>
          <nav aria-labelledby="f-studio" className="ds-footer__col">
            <h3 id="f-studio">Plateforme</h3>
            {STUDIO_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="ds-footer__link">
                {l.label}
              </Link>
            ))}
          </nav>
          {agents.length > 0 && (
            <nav aria-labelledby="f-team" className="ds-footer__col">
              <h3 id="f-team">L&apos;équipe</h3>
              {agents.map((a) => (
                <Link key={a.slug} href={`/agents/${a.slug}`} className="ds-footer__link ds-footer__link--text">
                  {a.name} <span className="ds-footer__role">· {a.role.toLowerCase()}</span>
                </Link>
              ))}
            </nav>
          )}
          <div className="ds-footer__col">
            <h3>Contact</h3>
            <a href={`mailto:${CONTACT_EMAIL}`} className="ds-footer__link">
              {CONTACT_EMAIL}
            </a>
            <a href="#services" className="ds-footer__link">Nos services</a>
            <a href="#apropos" className="ds-footer__link">À propos</a>
          </div>
        </div>

        <div className="ds-footer__bottom">
          <span>© {year} Saturn Studio · Propriétaire : Fallou Thiane</span>
          <a href="#accueil" className="ds-footer__top">
            Haut de page <Icon name="ArrowUp" size={14} aria-hidden />
          </a>
        </div>
      </div>

      {/* Signature : wordmark entier, en fondu vers le bas (jamais tronqué au milieu d'une lettre). */}
      <div className="ds-footer__word" aria-hidden>
        saturn
      </div>
    </footer>
  );
}
