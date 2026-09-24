import Link from "next/link";
import {
  YouTubeWidget,
  FirefliesWidget,
  GmailWidget,
  DriveWidget,
  RecentDeliverablesWidget,
} from "@/components/dashboard/Widgets";
import { Icon } from "@/components/Icon";
import { AppNav } from "@/components/landing/AppNav";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { ShapeCubeBlue } from "@/components/landing/Shapes";
import {
  getInbox,
  getMeetings,
  getYouTubeSnapshot,
  getDriveSnapshot,
} from "@/lib/dataSources";
import { listAgents, TEAM_LEADER_SLUG } from "@/lib/agents";
import { OrchestrationBoard } from "@/components/orchestration/OrchestrationBoard";
import { AgentCard } from "@/components/agents/AgentCard";
import { SaturnLogo } from "@/components/brand/SaturnLogo";
import { ThreeBackdrop } from "@/components/motion/ThreeBackdrop";
import { listAllDeliverables } from "@/lib/deliverables";
import { getGoogleStatus } from "@/lib/integrations/google";
import type { YTSnapshot } from "@/lib/integrations/youtube";
import type { DriveSnapshot } from "@/lib/integrations/drive";

export const dynamic = "force-dynamic";

/**
 * Studio — Edition Bronx (juillet 2026). Le hub SaaS de la plateforme :
 * la grille des agents (chat au clic) d'abord, puis les stats et les
 * quatre flux connectés (YouTube / Fireflies / Gmail / Drive) et les
 * livrables récents. Même langage visuel que la landing.
 */
export default async function DashboardPage() {
  const [inbox, meetings, yt, drive, deliverables, google, agents] =
    await Promise.all([
      getInbox(),
      getMeetings(),
      getYouTubeSnapshot(),
      getDriveSnapshot(),
      listAllDeliverables(),
      getGoogleStatus(),
      listAgents(),
    ]);

  const ytData = (yt.data as YTSnapshot | undefined) ?? null;
  const driveData = (drive.data as DriveSnapshot | undefined) ?? null;
  const pastMeetings = meetings.data.filter((m) => new Date(m.date) <= new Date());
  const urgentMails = inbox.data.filter((e) => e.urgency === "high").length;
  const deliverablesTotal = deliverables.length;
  const pdfsTotal = deliverables.filter((d) => d.filename.toLowerCase().endsWith(".pdf")).length;

  return (
    <div className="bronx-page min-h-screen w-full">
      <AppNav />
      <ScrollReveal />

      {/* ============ GRILLE DES AGENTS (le cœur du SaaS) ============ */}
      {/* La Studio bar est collante EN FLUX : le contenu commence juste après,
          sans réserve de hauteur ni seconde barre. pt généreux = respiration. */}
      <section className="relative px-6 sm:px-10 pb-16 pt-10 sm:pt-14">
        {/* Fond WebGL décoratif, cantonné au bandeau de titre pour ne jamais
            passer derrière le texte des cartes. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[260px] overflow-hidden">
          <ThreeBackdrop intensity="soft" />
        </div>

        <div className="relative mx-auto max-w-[1400px]">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="althea-eyebrow mb-2">
                Votre équipe · données {google.connected ? "live" : "mock"}
              </div>
              {/* Compte dérivé de la liste réelle : il suit automatiquement
                  toute entrée ajoutée ou retirée de `AGENTS`. */}
              <h2 className="bronx-h2">
                {agents.length} employés <em>IA</em>
              </h2>
              {/* Statut (jadis dans la TopBar), maintenant dans le flux du titre. */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="ds-pill ds-pill-ok">
                  <span className="ds-pill-dot" aria-hidden />
                  {agents.length} agents en ligne
                </span>
                {urgentMails > 0 && (
                  <span
                    className="ds-pill"
                    style={{ background: "var(--surface-3)", color: "var(--text-2)" }}
                  >
                    {urgentMails} email{urgentMails > 1 ? "s" : ""} urgent
                    {urgentMails > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
            <p className="bronx-body max-w-xs sm:text-right">
              Ouvrez une conversation, lancez une exécution ou consultez les livrables
              déjà produits.
            </p>
          </div>

          <div className="ds-grid">
            {agents.map((agent, i) => (
              <AgentCard key={agent.slug} agent={agent} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ============ ORCHESTRATION ============ */}
      <section className="relative px-6 sm:px-10 pb-14">
        <div className="mx-auto max-w-[1400px]" data-reveal>
          <div className="mb-6">
            <div className="althea-eyebrow mb-2">— Travail d&apos;équipe</div>
            <h2 className="bronx-h2">
              Un objectif, <em>plusieurs agents</em>
            </h2>
          </div>
          <OrchestrationBoard agents={agents} leaderSlug={TEAM_LEADER_SLUG} />
        </div>
      </section>

      {/* ============ 4 STAT CARDS ============ */}
      <section className="relative px-6 sm:px-10 pb-14">
        <div className="mx-auto max-w-[1400px] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5" data-reveal>
          <StatTile
            icon="Youtube"
            label="Abonnés YouTube"
            value={ytData ? ytData.channel.subscribers.toLocaleString("fr-FR") : "—"}
            hint={ytData ? `+${ytData.analytics.totals.subscribersGained} sur 30j` : "Non connecté"}
            href="/settings"
          />
          <StatTile
            icon="Mic"
            label="Calls analysés"
            value={pastMeetings.length}
            hint={`${pastMeetings.filter((m) => m.sentiment === "positive").length} positifs`}
            href="/agents/fireflies"
          />
          <StatTile
            icon="Mail"
            label="Emails urgents"
            value={urgentMails}
            hint={`sur ${inbox.data.length} dans l'inbox`}
            href="/settings"
          />
          <StatTile
            icon="Files"
            label="Livrables produits"
            value={deliverablesTotal}
            hint={`${pdfsTotal} PDF · ${deliverablesTotal - pdfsTotal} fichiers texte`}
            accent
            href="/agents/createur-contenu"
          />
        </div>
      </section>

      {/* ============ WIDGETS PRINCIPAUX ============ */}
      <section className="relative px-6 sm:px-10 pb-12">
        <ShapeCubeBlue className="bronx-shape bronx-float-a hidden lg:block" style={{ top: "-30px", right: "10%" }} size={90} />
        <div className="mx-auto max-w-[1400px]">
          <div className="flex items-end justify-between gap-6 mb-8 flex-wrap">
            <div>
              <div className="althea-eyebrow mb-2">— 01 — Sources</div>
              <h2 className="bronx-h2">
                Quatre flux <em>connectés</em>
              </h2>
            </div>
            <p className="bronx-body max-w-xs text-right">
              YouTube, Fireflies, Gmail, Drive. Vos agents lisent ces sources et produisent les livrables ci-dessous.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <CardWrap>
              <YouTubeWidget snapshot={ytData} live={yt.live} lastUpdated={yt.lastUpdated} />
            </CardWrap>
            <CardWrap>
              <FirefliesWidget meetings={meetings.data} live={meetings.live} lastUpdated={meetings.lastUpdated} />
            </CardWrap>
            <CardWrap>
              <GmailWidget emails={inbox.data} live={inbox.live} lastUpdated={inbox.lastUpdated} />
            </CardWrap>
            <CardWrap>
              <DriveWidget snapshot={driveData} live={drive.live} lastUpdated={drive.lastUpdated} />
            </CardWrap>
          </div>
        </div>
      </section>

      {/* ============ LIVRABLES RÉCENTS ============ */}
      <section className="relative px-6 sm:px-10 pb-20">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex items-end justify-between gap-6 mb-8 flex-wrap">
            <div>
              <div className="althea-eyebrow mb-2">— 02 — Livrables</div>
              <h2 className="bronx-h2">
                Tout ce qui sort <em>du studio</em>
              </h2>
            </div>
            <Link href="/" className="althea-pill-cta text-[12px]">
              Retour à l&apos;accueil
              <Icon name="ArrowUpRight" size={12} />
            </Link>
          </div>
          <CardWrap>
            <RecentDeliverablesWidget items={deliverables} />
          </CardWrap>
        </div>
      </section>

      {/* ============ FOOTER mini ============ */}
      <footer
        className="relative px-6 sm:px-10 py-10 border-t"
        style={{ borderColor: "var(--line-1)" }}
      >
        <div
          className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 text-[12px]"
          style={{ color: "var(--text-3)" }}
        >
          <span style={{ color: "var(--text-1)" }}>
            <SaturnLogo variant="full" size={17} />
          </span>
          <span>Propriétaire : Fallou Thiane · © 2026 Saturn Studio</span>
        </div>
      </footer>
    </div>
  );
}

/* =================================================================
   COMPOSANTS LOCAUX — Bronx
   ================================================================= */

/** Enveloppe carte blanche Bronx autour des widgets data (non modifiés). */
function CardWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="althea-card overflow-hidden" style={{ borderRadius: 24 }} data-reveal>
      {children}
    </div>
  );
}

/** StatTile — carte stat avec gros chiffre display bold (Bronx). */
function StatTile({
  icon,
  label,
  value,
  hint,
  accent,
  href,
}: {
  icon: string;
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
  href?: string;
}) {
  const content = (
    <div className="althea-card p-6 h-full flex flex-col justify-between gap-7">
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{
            background: accent ? "var(--color-primary-soft)" : "var(--surface-1)",
            color: accent ? "var(--color-primary-strong)" : "var(--text-2)",
          }}
        >
          <Icon name={icon} size={18} />
        </div>
        {href && (
          <Icon name="ArrowUpRight" size={14} style={{ color: "var(--text-3)" }} />
        )}
      </div>
      <div>
        <div className="althea-eyebrow mb-2">{label}</div>
        <div
          className="bronx-name"
          style={{
            fontSize: "clamp(36px, 3.2vw, 52px)",
            lineHeight: 0.95,
            color: accent ? "var(--color-primary)" : "var(--text-1)",
          }}
        >
          {value}
        </div>
        {hint && (
          <div className="mt-2 text-[11px]" style={{ color: "var(--text-3)" }}>
            {hint}
          </div>
        )}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block h-full">{content}</Link> : <div className="h-full">{content}</div>;
}
