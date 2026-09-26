import { Icon } from "@/components/Icon";
import { getInbox, getMeetings, getYouTubeSnapshot, getDriveSnapshot } from "@/lib/dataSources";
import { SyncButton } from "@/components/SyncButton";
import { getGoogleStatus, isGoogleConfigured } from "@/lib/integrations/google";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { AppNav } from "@/components/landing/AppNav";

import { SiteFooter } from "@/components/brand/SiteFooter";
interface Integration {
  id:
    | "anthropic"
    | "fireflies"
    | "google"
    | "youtube"
    | "gmail"
    | "drive"
    | "cv"
    | "instagram"
    | "linkedin"
    | "tiktok";
  title: string;
  /** Agents qui consomment cette connexion — affiché en clair sur la carte. */
  agent: string;
  icon: string;
  envVar: string;
  configured: boolean;
  /** Valeur masquée (jamais la valeur réelle). Ex. « sk-ant••••4f2a ». */
  masked?: string;
  live?: boolean;
  lastUpdated?: string;
  itemsCount?: number;
  syncEndpoint?: string;
  connectUrl?: string;
  email?: string;
  setupSteps: string[];
  notes?: string;
}

/**
 * Masque un secret pour l'affichage.
 *
 * SÉCURITÉ : cette fonction tourne côté serveur (composant serveur) et ne
 * renvoie QUE le masque. La valeur réelle de la variable d'environnement ne
 * traverse jamais la frontière serveur → client et n'est jamais incluse dans
 * le bundle. Ne jamais retourner `value` tel quel.
 */
function mask(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.length <= 8) return "•".repeat(8);
  return `${value.slice(0, 4)}${"•".repeat(10)}${value.slice(-4)}`;
}

async function getIntegrations(): Promise<Integration[]> {
  const [meetings, inbox, googleStatus, yt, drive] = await Promise.all([
    getMeetings(),
    getInbox(),
    getGoogleStatus(),
    getYouTubeSnapshot(),
    getDriveSnapshot(),
  ]);

  return [
    {
      id: "anthropic",
      title: "Anthropic (Claude)",
      agent: "Emma · Léa · Nina · Awa · Fallou · Basse",
      icon: "Cpu",
      envVar: "ANTHROPIC_API_KEY",
      configured: Boolean(process.env.ANTHROPIC_API_KEY),
      masked: mask(process.env.ANTHROPIC_API_KEY),
      setupSteps: [
        "Créez une clé sur console.anthropic.com",
        "Collez-la dans .env.local à la variable ANTHROPIC_API_KEY=",
        "Redémarrez le dev server",
      ],
      notes:
        "Moteur de raisonnement de tous les agents. Claude Sonnet 4.6 en production.",
    },
    {
      id: "fireflies",
      title: "Fireflies (calls)",
      agent: "Fallou (analyste de calls) · Basse (propositions)",
      icon: "Mic",
      envVar: "FIREFLIES_API_KEY",
      configured: Boolean(process.env.FIREFLIES_API_KEY),
      masked: mask(process.env.FIREFLIES_API_KEY),
      syncEndpoint: "/api/integrations/fireflies/sync?limit=20",
      live: meetings.live,
      lastUpdated: meetings.lastUpdated,
      itemsCount: meetings.data.length,
      setupSteps: [
        "Sur app.fireflies.ai → Settings → Developer settings → Generate API Key",
        "Collez la clé dans .env.local à FIREFLIES_API_KEY=",
        "Redémarrez le dev server",
        "Cliquez « Synchroniser » pour fetch les 20 derniers calls",
      ],
      notes:
        "Chaque clic fetch vos calls récents (titre, date, participants, résumé, action items) depuis l'API GraphQL Fireflies.",
    },
    {
      id: "google",
      title: "Google (compte)",
      agent: "Nina (veille) · Awa (prospection)",
      icon: "Globe",
      envVar: "GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET",
      configured: isGoogleConfigured() && googleStatus.connected,
      email: googleStatus.email,
      lastUpdated: googleStatus.connectedAt,
      connectUrl: isGoogleConfigured() ? "/api/integrations/google/start" : undefined,
      setupSteps: [
        "Credentials OAuth configurées dans .env.local ✓",
        "Cliquez « Connecter Google » pour l'écran de consentement",
        "Approuvez les accès YouTube + Gmail",
        "Vous serez redirigé ici automatiquement",
      ],
      notes:
        "Un seul consentement couvre YouTube (analytics, vidéos) et Gmail (lecture). Le refresh token est persisté localement, vous ne re-consentez pas à chaque session.",
    },
    {
      id: "youtube",
      title: "YouTube (chaîne + analytics)",
      agent: "Nina — veille tendances",
      icon: "CirclePlay",
      envVar: "via Google OAuth",
      configured: googleStatus.connected,
      syncEndpoint: "/api/integrations/youtube/sync?days=30&videos=20",
      live: yt.live,
      lastUpdated: yt.lastUpdated,
      itemsCount: 0,
      setupSteps: [
        "Connectez d'abord Google ci-dessus",
        "Cliquez « Synchroniser » pour fetch les 30 derniers jours d'analytics + les 20 dernières vidéos",
        "Posez ensuite vos questions à L'Analyste — il a les données en contexte",
      ],
      notes:
        "Fetch via YouTube Data API v3 + YouTube Analytics API. Infos chaîne (abonnés, vues cumul), dernières vidéos (titre, stats), analytics période (vues/jour, durée moyenne, abonnés gagnés).",
    },
    {
      id: "gmail",
      title: "Gmail (inbox)",
      agent: "Awa (prospection) · Basse (envoi propositions)",
      icon: "Mail",
      envVar: "via Google OAuth",
      configured: googleStatus.connected,
      syncEndpoint: "/api/integrations/gmail/sync?limit=20",
      live: inbox.live,
      lastUpdated: inbox.lastUpdated,
      itemsCount: inbox.data.length,
      setupSteps: [
        "Google connecté (scope gmail.readonly inclus) ✓",
        "Cliquez « Synchroniser » pour fetch les 20 derniers emails de votre inbox",
        "L'Agent Gmail utilisera directement ces vrais emails pour produire votre to-do",
      ],
      notes:
        "Fetch les 20 derniers emails (14 derniers jours) via Gmail API. Chaque email est catégorisé automatiquement (client / prospect / admin / newsletter) et scoré en urgence à partir des mots-clés et labels.",
    },
    {
      id: "drive",
      title: "Google Drive (fichiers)",
      agent: "Les 6 agents — contexte partagé",
      icon: "HardDrive",
      envVar: "via Google OAuth",
      configured: googleStatus.connected,
      syncEndpoint: "/api/integrations/drive/sync?limit=30",
      live: drive.live,
      lastUpdated: drive.lastUpdated,
      itemsCount: (drive.data as { files?: unknown[] } | undefined)?.files?.length ?? 0,
      setupSteps: [
        "Google connecté (scope drive.readonly inclus) ✓",
        "Si vous venez d'ajouter Drive, cliquez d'abord « Reconnecter Google » en haut pour obtenir le nouveau scope",
        "Cliquez « Synchroniser » pour indexer les 30 derniers fichiers modifiés",
      ],
      notes:
        "Fetch des 30 fichiers les plus récemment modifiés (Docs, Sheets, Slides, PDF…). Injecté dans le contexte de tous les agents marketing : ils peuvent référencer un fichier par son nom quand c'est pertinent.",
    },
    {
      id: "instagram",
      title: "Instagram / Meta",
      agent: "Nina (veille Reels) · Emma (publication produit)",
      icon: "Camera",
      envVar: "META_ACCESS_TOKEN",
      configured: Boolean(process.env.META_ACCESS_TOKEN),
      masked: mask(process.env.META_ACCESS_TOKEN),
      setupSteps: [
        "Créez une app sur developers.facebook.com → produit « Instagram Graph API »",
        "Reliez le compte Instagram professionnel à une page Facebook",
        "Générez un token longue durée (60 jours) et notez sa date d'expiration",
        "Collez-le dans .env.local à META_ACCESS_TOKEN=",
      ],
      notes:
        "Sert à Nina pour lire les Reels les plus vus d'un hashtag, et à Emma pour programmer les vidéos produit. Le token Meta expire tous les 60 jours : prévoyez son renouvellement.",
    },
    {
      id: "linkedin",
      title: "LinkedIn",
      agent: "Léa (posts) · Awa (prospection)",
      icon: "Briefcase",
      envVar: "LINKEDIN_ACCESS_TOKEN",
      configured: Boolean(process.env.LINKEDIN_ACCESS_TOKEN),
      masked: mask(process.env.LINKEDIN_ACCESS_TOKEN),
      setupSteps: [
        "Créez une app sur linkedin.com/developers",
        "Demandez les produits « Share on LinkedIn » et « Sign In with LinkedIn »",
        "Générez un access token OAuth 2.0 pour le compte qui publie",
        "Collez-le dans .env.local à LINKEDIN_ACCESS_TOKEN=",
      ],
      notes:
        "Permet à Léa de publier les posts qu'elle rédige et à Awa d'enrichir les profils prospects.",
    },
    {
      id: "tiktok",
      title: "TikTok",
      agent: "Nina (veille) · Emma (vidéos produit)",
      icon: "Music",
      envVar: "TIKTOK_ACCESS_TOKEN",
      configured: Boolean(process.env.TIKTOK_ACCESS_TOKEN),
      masked: mask(process.env.TIKTOK_ACCESS_TOKEN),
      setupSteps: [
        "Créez une app sur developers.tiktok.com",
        "Activez « Content Posting API » et « Research API » selon vos besoins",
        "Générez un access token pour le compte concerné",
        "Collez-le dans .env.local à TIKTOK_ACCESS_TOKEN=",
      ],
      notes:
        "Veille sur les tendances et publication des vidéos produit générées par Emma.",
    },
  ];
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; google_error?: string }>;
}) {
  const integrations = await getIntegrations();
  const sp = await searchParams;
  const configured = integrations.filter((i) => i.configured).length;

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      {/* Nav commune. Cette page avait sa propre barre à quatre liens, qui
          n'exposait même pas « Connexions » — la section où l'on se trouve. */}
      <AppNav />

      {/* ============ HERO ============ */}
      <section className="relative px-6 sm:px-10 pt-10 sm:pt-16 pb-12">
        <div className="mx-auto max-w-[920px]">
          <div className="althea-eyebrow mb-3">
            — Connexions · {configured} / {integrations.length} actives
          </div>
          <h1 className="althea-headline althea-text-halo" style={{ fontSize: "clamp(40px, 6vw, 88px)" }}>
            Vos clés &amp; <em>connecteurs.</em>
          </h1>
          <p className="althea-lede mt-5 max-w-[560px]">
            Une clé = un sésame pour qu&apos;un agent puisse parler à un service externe (Gemini, Gmail, YouTube, Fireflies…).
            Collez la clé ou connectez en OAuth, cliquez « Synchroniser », les données arrivent.
          </p>
        </div>
      </section>

      <main className="relative px-6 sm:px-10 pb-20">
        <div className="mx-auto max-w-[920px] space-y-5">
          {sp.google === "connected" && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
              <Icon name="CheckCircle" size={18} className="text-emerald-700 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-emerald-900">Google connecté avec succès</p>
                <p className="text-sm text-emerald-800">
                  Vous pouvez maintenant synchroniser YouTube (et Gmail bientôt).
                </p>
              </div>
            </div>
          )}
          {sp.google_error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
              <Icon name="AlertCircle" size={18} className="text-red-700 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-red-900">Erreur de connexion Google</p>
                <p className="text-sm text-red-800 font-mono break-all">{sp.google_error}</p>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-[var(--color-marine-200)] bg-[var(--color-marine-50)] p-4 text-sm text-[var(--color-ink)]">
            <div className="flex items-start gap-2">
              <Icon name="Zap" size={16} className="mt-0.5 shrink-0 text-[var(--color-ink)]" />
              <div>
                <p className="font-semibold">Connecteurs natifs — tout géré dans la plateforme</p>
                <p className="mt-1 text-[var(--color-ink)] leading-relaxed">
                  Chaque source est fetchée en direct par la plateforme. Aucun outil tiers à configurer.
                  Vous collez une clé ou vous vous connectez en OAuth, vous cliquez « Synchroniser »,
                  les données arrivent dans l'agent correspondant.
                </p>
              </div>
            </div>
          </div>

          {integrations.map((i) => (
            <IntegrationCard key={i.id} integration={i} />
          ))}
        </div>
      </main>

      {/* ============ FOOTER ============ */}
      <SiteFooter />
    </div>
  );
}

function IntegrationCard({ integration: i }: { integration: Integration }) {
  const rel = i.lastUpdated
    ? new Date(i.lastUpdated).toLocaleString("fr-FR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const statusLabel = i.configured
    ? i.live === true
      ? "Connecté · données live"
      : i.id === "google"
      ? "Connecté"
      : "Configuré · jamais synchronisé"
    : "Non configuré";

  const statusColor = i.configured
    ? i.live === true || i.id === "google"
      ? "emerald"
      : "amber"
    : "muted";

  return (
    <div className="relative">
      <div
        className="althea-halo"
        style={{ width: "75%", height: "75%", left: "50%", top: "50%", opacity: 0.5 }}
        aria-hidden
      />
      <div className="relative althea-card overflow-hidden" style={{ borderRadius: 18 }}>
      <header className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[var(--color-line)]">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg shrink-0",
            i.configured ? "bg-emerald-100 text-emerald-700" : "bg-[var(--color-marine-50)] text-[var(--color-muted)]"
          )}>
            <Icon name={i.icon} size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[var(--color-ink)] truncate">
              {i.title}
            </h2>
            <p className="text-xs text-[var(--color-muted)]">
              Utilisé par : {i.agent}
              {i.email && <span className="ml-2 text-[var(--color-ink)]">· {i.email}</span>}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border",
            statusColor === "emerald" && "bg-emerald-50 text-emerald-700 border-emerald-200",
            statusColor === "amber" && "bg-amber-50 text-amber-700 border-amber-200",
            // Neutre et non vert : « Non configuré » ne doit pas se lire
            // comme un succès (--color-nude-* est remappé sur du vert sapin).
            // --text-2 et non --text-3 : sur --surface-3, le gris clair ne
            // tenait que ~2.9:1, sous le minimum de 4.5:1 pour du petit texte.
            statusColor === "muted" && "bg-[var(--surface-3)] text-[var(--text-2)] border-[var(--line-1)]"
          )}>
            {i.live === true && <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
            {statusLabel}
          </span>
          {rel && (
            <p className="mt-1 text-[10px] text-[var(--color-muted)]">MAJ : {rel}</p>
          )}
          {i.itemsCount !== undefined && i.itemsCount > 0 && (
            <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
              {i.itemsCount} élément{i.itemsCount > 1 ? "s" : ""}
              {!i.live && " (démo)"}
            </p>
          )}
        </div>
      </header>

      <div className="px-6 py-4 space-y-4">
        {i.notes && (
          <p className="text-sm leading-relaxed text-[var(--color-ink)]">{i.notes}</p>
        )}

        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 text-[11px] min-w-[180px]">
            <div className="font-semibold uppercase tracking-widest text-[var(--color-muted)]">
              Variable d'env
            </div>
            <code className="mt-1 inline-block rounded bg-[var(--color-surface)] px-2 py-1 text-[11px] text-[var(--color-ink)] font-mono">
              {i.envVar}
            </code>

            {/* Valeur masquée : confirme qu'une clé est bien chargée sans
                jamais révéler le secret. Le masque est calculé côté serveur. */}
            <div className="mt-2 font-semibold uppercase tracking-widest text-[var(--color-muted)]">
              Valeur
            </div>
            <code
              className="mt-1 inline-block rounded px-2 py-1 font-mono text-[11px]"
              style={{
                background: "var(--surface-3)",
                color: i.masked ? "var(--text-1)" : "var(--text-3)",
              }}
            >
              {i.masked ?? "non renseignée"}
            </code>
          </div>

          <div className="flex items-end gap-2">
            {i.connectUrl && (
              <Link
                href={i.connectUrl}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border",
                  i.configured
                    ? "border-[var(--color-line)] bg-white text-[var(--color-ink)] hover:bg-[var(--color-marine-50)]"
                    : "border-[var(--color-marine-700)] bg-[var(--color-ink)] text-white hover:bg-[var(--color-ink)]"
                )}
              >
                <Icon name="Link" size={12} />
                {i.configured ? "Reconnecter" : "Connecter Google"}
              </Link>
            )}
            {i.syncEndpoint && (
              <SyncButton
                endpoint={i.syncEndpoint}
                label={i.live ? "Re-synchroniser" : "Synchroniser"}
                disabled={!i.configured}
                disabledReason={
                  !i.configured
                    ? i.id === "youtube"
                      ? "Connectez d'abord Google"
                      : "Configurez d'abord la clé API"
                    : undefined
                }
              />
            )}
          </div>
        </div>

        <details className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]">
          <summary className="cursor-pointer list-none px-4 py-2.5 text-xs font-semibold text-[var(--color-ink)] flex items-center gap-2">
            <Icon name="ChevronRight" size={12} />
            Étapes de configuration
          </summary>
          <ol className="border-t border-[var(--color-line)] px-4 py-3 space-y-2">
            {i.setupSteps.map((s, idx) => (
              <li key={idx} className="flex gap-2 text-[12px] text-[var(--color-ink)] leading-snug">
                <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-marine-100)] text-[10px] font-bold text-[var(--color-ink)]">
                  {idx + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </details>
      </div>
      </div>
    </div>
  );
}
