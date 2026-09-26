import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SaturnLogo } from "@/components/brand/SaturnLogo";
import { AgentAvatar } from "@/components/AgentAvatar";
import { Icon } from "@/components/Icon";
import { SESSION_COOKIE, authEnabled, safeNext, verifySessionToken } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Connexion · Saturn Studio", robots: { index: false } };

const CREW = ["fireflies", "prospection", "proposition", "createur-contenu", "veille", "ecommerce"];

const ERRORS: Record<string, string> = {
  invalid: "Mot de passe incorrect. Vérifiez les majuscules et réessayez.",
  locked: "Trop d'essais. Réessayez dans 15 minutes.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNext(rawNext);
  const jar = await cookies();
  if (!authEnabled() || verifySessionToken(jar.get(SESSION_COOKIE)?.value)) redirect(next);
  const message = error ? ERRORS[error] ?? ERRORS.invalid : null;

  return (
    <main className="login-page">
      <div className="login-card">
        <Link href="/" className="login-logo" aria-label="Saturn Studio, retour à l'accueil">
          <SaturnLogo variant="full" size={20} />
        </Link>

        <div className="login-crew" aria-hidden>
          {CREW.map((slug) => (
            <AgentAvatar key={slug} slug={slug} size={40} />
          ))}
        </div>

        <h1 className="login-title">Accès au Studio</h1>
        <p className="login-lede">Votre équipe IA vous attend. Entrez le mot de passe du Studio.</p>

        <form action="/api/auth/login" method="post" className="login-form">
          <input type="hidden" name="next" value={next} />
          {/* Identifiant caché : permet au gestionnaire de mots de passe d'enregistrer l'accès. */}
          <input type="text" name="username" autoComplete="username" defaultValue="fallou" hidden readOnly />
          <label htmlFor="password" className="login-label">Mot de passe</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            className="login-input"
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? "login-error" : undefined}
          />
          {message && (
            <p id="login-error" role="alert" className="login-error">
              <Icon name="AlertCircle" size={15} aria-hidden />
              {message}
            </p>
          )}
          <button type="submit" className="login-submit">
            Entrer dans le studio
            <Icon name="ArrowRight" size={16} aria-hidden />
          </button>
        </form>

        <Link href="/" className="login-back">
          <Icon name="ArrowLeft" size={14} aria-hidden /> Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
