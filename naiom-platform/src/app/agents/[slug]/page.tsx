import Link from "next/link";
import { SaturnLogo } from "@/components/brand/SaturnLogo";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { getAgentBySlug, listAgents, ownedSlug } from "@/lib/agents";
import { agentPortraitSrc, agentAccent } from "@/lib/agentsUI";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ThreeBackdrop } from "@/components/motion/ThreeBackdrop";
import { SetupTools } from "@/components/SetupTools";
import { countDeliverables, listDeliverables } from "@/lib/deliverables";
import { getAgentUsage } from "@/lib/analytics/usage";
import { DeliverablesPanel } from "@/components/DeliverablesPanel";
import { InboxPreview, MeetingsPreview, CandidatesPreview } from "@/components/OpsContextPanels";
import { AgentAvatar } from "@/components/AgentAvatar";
import { AgentTabs } from "@/components/AgentTabs";
import { ThumbnailStudio } from "@/components/ThumbnailStudio";
import { EcommerceStudio } from "@/components/EcommerceStudio";
import { ProspectionStudio } from "@/components/ProspectionStudio";
import { VeilleStudio } from "@/components/VeilleStudio";
import { PropositionStudio } from "@/components/PropositionStudio";
import { ComptaStudio } from "@/components/ComptaStudio";
import { CreativeStudio } from "@/components/CreativeStudio";
import { ContentStudio } from "@/components/ContentStudio";
import { getMeetings } from "@/lib/dataSources";
import { Icon } from "@/components/Icon";
import type { AgentSlug } from "@/lib/types";

import { SiteFooter } from "@/components/brand/SiteFooter";
import { MobileTabBar } from "@/components/nav/MobileTabBar";
import type { AgentMeta } from "@/lib/types";
const SUGGESTIONS: Partial<Record<AgentSlug, string[]>> = {
  fireflies: [
    "Résume mes calls de la semaine avec un plan d'action équipe",
    "Score BANT pour mes prospects actifs",
    "Les points de blocage qui reviennent en rendez-vous",
  ],
  prospection: [
    "Aide-moi à définir mon ICP pour vendre des agents IA à des PME",
    "Améliore cet email de prospection : [collez votre email]",
    "Quelle cadence de relance pour un prospect qui n'a pas répondu ?",
  ],
  proposition: [
    "Transforme mon dernier call en proposition commerciale",
    "Une proposition béton après le rendez-vous, avec 3 options chiffrées",
    "Reprends les besoins du call et prépare le PDF à envoyer au prospect",
  ],
  "createur-contenu": [
    "Un post LinkedIn long sur « outil vs collègue » en IA",
    "3 hooks à tester pour le lancement d'un agent IA",
    "Un email de nurturing à J+1 après un webinaire",
  ],
  veille: [
    "Les reels les plus vus cette semaine sur #iamarketing",
    "Décortique le script des 5 meilleures vidéos du hashtag",
    "Quelles tendances de format reviennent en ce moment ?",
  ],
  ecommerce: [
    "Écris-moi un script UGC de 20 secondes pour une gourde isotherme",
    "Quel type d'avatar choisir pour vendre à des mamans 30-45 ans ?",
    "Donne-moi 3 hooks pour une vidéo Instagram sur un produit skincare",
  ],
};

export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const { tab: requestedTab } = await searchParams;
  const agent = await getAgentBySlug(slug);
  if (!agent) notFound();
  // MODE TEMPLATE : accès refusé aux agents verrouillés → page « Débloquer ».
  if (agent.status === "locked") redirect("/decouvrir");

  const isPlaceholder = agent.status === "coming-soon";
  // Barre de navigation : les cinq autres agents de l'équipe.
  const allAgents = await listAgents();

  const [count, usage30d] = await Promise.all([
    agent.status === "active" ? countDeliverables(agent.slug) : Promise.resolve(0),
    getAgentUsage(agent.slug, { days: 30 }),
  ]);

  const lastDeliverable = count > 0
    ? (await listDeliverables(agent.slug as AgentSlug))[0]
    : null;

  const contextPanel = agent.slug === "fireflies" ? <MeetingsPreview /> : null;

  // Studio Proposition (Basse) : branché aux calls Fireflies.
  const proposalPanel =
    agent.slug === "proposition"
      ? (
          <PropositionStudio
            calls={(await getMeetings()).data.map((m) => ({
              id: m.id,
              title: m.title,
              date: m.date,
              type: m.type,
              participants: m.participants,
              summary: m.summary,
            }))}
          />
        )
      : undefined;

  const owned = ownedSlug();
  const portrait = agentPortraitSrc(agent.slug);

  return (
    <div className="relative min-h-screen w-full overflow-x-clip">
      {/* ============ HEADER ALTHEA (identique home / dashboard) ============ */}
      <header className="agent-bar sticky top-0 z-30">
        <div className="mx-auto max-w-[1400px] flex items-center justify-between gap-4 px-6 sm:px-10 py-6">
<Link href="/" aria-label="Saturn Studio, retour à l'accueil" className="inline-flex min-h-[44px] items-center transition hover:opacity-70" style={{ color: "var(--text-1)" }}>
            <SaturnLogo variant="full" size={18} />
          </Link>

          {/* Sélecteur d'agents : les 6, l'agent affiché est marqué (anneau
              d'accent + aria-current). Desktop : dans la barre ; mobile : rangée
              défilable sous la barre (cf. plus bas). */}
          <nav className="hidden md:flex items-center gap-2" aria-label="Agents">
            {allAgents.map((a) => (
              <AgentSwitchChip key={a.slug} agent={a} current={a.slug === agent.slug} />
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* MODE TEMPLATE : bouton pour (ré)ouvrir la config des clés à tout moment. */}
            {owned && <SetupTools slug={agent.slug} />}
            <ThemeToggle className="ds-icon-btn" />
            <Link href="/settings" className="ds-icon-btn" aria-label="Connexions et réglages">
              <Icon name="Settings" size={16} />
            </Link>
            <Link href="/dashboard" className="althea-pill-cta">
              <Icon name="ArrowLeft" size={12} />
              Studio
            </Link>
          </div>
        </div>
      </header>

      <nav className="agent-switch-row md:hidden" aria-label="Agents">
        {allAgents.map((a) => (
          <AgentSwitchChip key={a.slug} agent={a} current={a.slug === agent.slug} withName />
        ))}
      </nav>
      <MobileTabBar />

      {/* ============ Layout 2 colonnes : avatar gauche sticky, panneau droite ============ */}
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 pt-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 lg:gap-10 items-start">

          {/* ============ Colonne gauche : avatar + identité + stats ============ */}
          <aside className="lg:sticky lg:top-24 space-y-5">
            {/* Bloc avatar : althea-card blanche avec halo lumineux derrière le sujet */}
            <div className="relative althea-card p-6 text-center overflow-hidden">
              {/* Fond WebGL discret derrière le portrait. */}
              <ThreeBackdrop intensity="soft" />

              {/* Portrait 3:4 pré-recadré sur le visage. Ratio fixe → pas de
                  saut de mise en page au chargement. Repli sur l'avatar rond
                  pour les agents sans photo. */}
              <div className="relative" style={{ zIndex: 2 }}>
                {portrait ? (
                  <div
                    className="relative mx-auto w-full max-w-[260px] overflow-hidden"
                    style={{ aspectRatio: "3 / 4", borderRadius: "var(--r-lg)" }}
                  >
                    <Image
                      src={portrait}
                      alt={`Portrait de ${agent.name}`}
                      width={640}
                      height={853}
                      priority
                      sizes="(max-width: 1024px) 90vw, 320px"
                      className="h-full w-full object-cover"
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0"
                      style={{ boxShadow: `inset 0 0 0 1px ${agentAccent(agent.slug)}33` }}
                    />
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <AgentAvatar slug={agent.slug} size={200} priority />
                  </div>
                )}
              </div>

              <div className="relative mt-2 flex items-center justify-center gap-2 flex-wrap">
                {isPlaceholder ? (
                  <span className="chip amber">
                    <Icon name="Clock" size={10} /> Bientôt
                  </span>
                ) : (
                  <span className="chip emerald">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    En ligne
                  </span>
                )}
                <span className="chip">
                  <Icon name="Cpu" size={10} /> {agent.model}
                </span>
              </div>

              <div className="relative mt-4">
                <div className="althea-eyebrow justify-center" style={{ display: "flex" }}>
                  — {agent.role}
                </div>
                <h1 className="althea-headline mt-2" style={{ fontSize: "clamp(40px, 4vw, 56px)", lineHeight: 0.95 }}>
                  {agent.name}
                </h1>
                <p className="althea-lede mt-3 max-w-[280px] mx-auto">
                  {agent.tagline}
                </p>
              </div>
            </div>

            {/* Bloc stats compact */}
            <div className="relative althea-card p-5">
              <div className="grid grid-cols-2 gap-4">
                <StatBlock value={count.toString()} label="Livrables" />
                <StatBlock value={formatCompact(usage30d.totalTokens)} label="Tokens · 30j" />
                <StatBlock
                  value={`$ ${usage30d.totalCostUsd.toFixed(2)}`}
                  label="Coût · 30j"
                  accent
                />
                <StatBlock
                  value={
                    usage30d.messagesCount > 0
                      ? `${Math.round(usage30d.successRate * 100)} %`
                      : "—"
                  }
                  label="Succès"
                  emerald={usage30d.successRate >= 0.95 && usage30d.messagesCount > 0}
                />
              </div>
              {(lastDeliverable || usage30d.lastActivity) && (
                <div className="mt-5 pt-4 border-t border-white/10 space-y-2 text-[11px] text-[var(--color-ink-dim)]">
                  {usage30d.lastActivity && (
                    <div className="flex items-center gap-2">
                      <Icon name="Clock" size={11} />
                      <span>Actif {formatRelativeDate(usage30d.lastActivity)}</span>
                    </div>
                  )}
                  {lastDeliverable && (
                    <div className="flex items-center gap-2">
                      <Icon name="FileText" size={11} className="shrink-0" />
                      <span className="truncate">« {lastDeliverable.title} »</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Icon name="Wrench" size={11} />
                    <span>{agent.tools.length} outil{agent.tools.length > 1 ? "s" : ""}</span>
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* ============ Colonne droite : tabs chat/analytics/fichiers/historique ============ */}
          <main>
            <AgentTabs
              agentSlug={agent.slug}
              agentName={agent.name}
              accent={agent.accent}
              suggestions={SUGGESTIONS[agent.slug as AgentSlug]}
              disabled={isPlaceholder}
              deliverablesCount={count}
              filesPanel={<DeliverablesPanel agentSlug={agent.slug as AgentSlug} />}
              contextPanel={contextPanel}
              videoPanel={agent.slug === "ecommerce" ? <EcommerceStudio /> : undefined}
              pipelinePanel={agent.slug === "prospection" ? <ProspectionStudio /> : undefined}
              veillePanel={agent.slug === "veille" ? <VeilleStudio /> : undefined}
              proposalPanel={proposalPanel}
              contentPanel={agent.slug === "createur-contenu" ? <ContentStudio /> : undefined}
              initialTab={requestedTab}
            />
          </main>
        </div>
      </div>

      {/* ============ Footer Althea ============ */}
      <SiteFooter />
    </div>
  );
}

/* ================= Composants UI ================= */

function StatBlock({
  value,
  label,
  accent,
  emerald,
}: {
  value: string;
  label: string;
  accent?: boolean;
  emerald?: boolean;
}) {
  return (
    <div>
      <div
        className={
          "text-[26px] leading-none h-display truncate " +
          (accent ? "text-[var(--color-accent)]" : emerald ? "text-emerald-300" : "text-[var(--color-ink)]")
        }
      >
        {value}
      </div>
      <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-ink-dim)]">
        {label}
      </div>
    </div>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "") + " M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(".0", "") + " k";
  return n.toString();
}

function formatRelativeDate(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffDays = Math.floor(diffH / 24);
  if (diffDays === 1) return "hier";
  if (diffDays < 7) return `il y a ${diffDays} j`;
  if (diffDays < 30) return `il y a ${Math.floor(diffDays / 7)} sem.`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Pastille d'agent du sélecteur. `current` = agent affiché (non cliquable). */
function AgentSwitchChip({ agent, current, withName }: { agent: AgentMeta; current: boolean; withName?: boolean }) {
  const locked = agent.status === "locked";
  const href = locked ? "/decouvrir" : `/agents/${agent.slug}`;
  const label = locked ? `${agent.name}, verrouillé` : `${agent.name}, ${agent.role}`;
  const body = (
    <>
      <span className="agent-chip-face" style={{ ["--chip-accent" as string]: agentAccent(agent.slug) }}>
        <AgentAvatar slug={agent.slug} size={44} />
        {locked && (
          <span className="agent-chip-lock" aria-hidden>
            <Icon name="Lock" size={14} />
          </span>
        )}
      </span>
      {withName ? (
        <span className="agent-chip-name">{agent.name}</span>
      ) : (
        <span className="agent-chip-tip" aria-hidden>
          <b>{agent.name}</b>
          <span>{locked ? "Verrouillé — débloquer" : agent.role}</span>
        </span>
      )}
    </>
  );
  const cls = `agent-chip${current ? " is-current" : ""}${locked ? " is-locked" : ""}`;
  return current ? (
    <span className={cls} aria-current="page" aria-label={`${agent.name} (agent affiché)`}>{body}</span>
  ) : (
    <Link href={href} className={cls} aria-label={label}>{body}</Link>
  );
}
